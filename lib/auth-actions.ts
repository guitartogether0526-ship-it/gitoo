"use server";

import type { SessionUser } from "./types";
import { ADMIN_USER } from "./admin";
import { can } from "./roles";
import { getSession } from "./session";
import { hashPassword, verifyPassword } from "./password";
import type { MemberRole } from "./types";
import {
  createMember,
  findByEmail,
  getCredential,
  removeMember,
  setApproved,
  setPasswordById,
  setProfile,
  setRole,
  setTeam,
  usernameTaken,
} from "./member-store";
import { isEmailConfigured, sendMail } from "./email";
import { randomBytes } from "node:crypto";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** 사람이 읽기 쉬운 임시 비밀번호 (10자) */
function genTempPassword(): string {
  return randomBytes(8).toString("base64url").replace(/[^a-zA-Z0-9]/g, "").slice(0, 10);
}

/** 관리자 비밀번호 (서버 전용) — 환경변수 ADMIN_PASSWORD 로만 설정. 미설정 시 관리자 로그인 불가. */
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;
const ADMIN_USERNAME = "admin";

type LoginResult = { user: SessionUser } | { error: string };

function toSession(m: {
  id: string;
  name: string;
  role: SessionUser["role"];
  part: string;
  initial: string;
  team_id: string | null;
}): SessionUser {
  return {
    id: m.id,
    name: m.name,
    role: m.role,
    part: m.part,
    initial: m.initial,
    team_id: m.team_id ?? null,
  };
}

/** 로그인 — 아이디 + 비밀번호 */
export async function login(usernameRaw: string, password: string): Promise<LoginResult> {
  const username = usernameRaw.trim().toLowerCase();
  if (!username || !password) return { error: "아이디와 비밀번호를 입력하세요." };

  // 관리자 계정
  if (username === ADMIN_USERNAME) {
    if (!ADMIN_PASSWORD)
      return { error: "관리자 로그인이 설정되지 않았습니다. 환경변수 ADMIN_PASSWORD 를 설정하세요." };
    if (password === ADMIN_PASSWORD) return { user: ADMIN_USER };
    return { error: "비밀번호가 올바르지 않습니다." };
  }

  const cred = await getCredential(username);
  if (!cred || !verifyPassword(password, cred.passwordHash)) {
    return { error: "아이디 또는 비밀번호가 올바르지 않습니다." };
  }
  if (!cred.member.approved) {
    return { error: "가입 승인 대기 중입니다. 관리자 승인 후 로그인할 수 있어요." };
  }
  return { user: toSession(cred.member) };
}

/** 회원가입 — 승인 대기(approved=false) 상태로 생성 */
export async function signup(input: {
  username: string;
  password: string;
  name: string;
  phone: string;
  email: string;
  part: string;
}): Promise<{ ok: true } | { error: string }> {
  const username = input.username.trim().toLowerCase();
  const name = input.name.trim();
  const phone = input.phone.trim();
  const email = input.email.trim().toLowerCase();
  const part = input.part.trim();

  if (!username || !input.password || !name) return { error: "필수 항목을 모두 입력하세요." };
  if (username === ADMIN_USERNAME) return { error: "사용할 수 없는 아이디입니다." };
  if (!/^[a-z0-9_]{3,20}$/.test(username))
    return { error: "아이디는 영문 소문자·숫자·_ 3~20자로 입력하세요." };
  if (input.password.length < 4) return { error: "비밀번호는 4자 이상이어야 합니다." };
  if (!phone) return { error: "휴대폰번호를 입력하세요." };
  if (!EMAIL_RE.test(email)) return { error: "올바른 이메일 주소를 입력하세요." };

  if (await usernameTaken(username)) return { error: "이미 사용 중인 아이디입니다." };

  try {
    await createMember({
      username,
      passwordHash: hashPassword(input.password),
      name,
      phone,
      email,
      part: part || "미정",
    });
  } catch {
    return { error: "가입 처리 중 오류가 발생했습니다. 관리자에게 문의하세요." };
  }
  return { ok: true };
}

/**
 * 아이디 찾기 — 가입 시 이메일로 아이디를 발송.
 * - 이메일 설정 시: 해당 메일로 발송하고 sent:true.
 * - 미설정 시: 화면에 아이디를 표시(sent:false, usernames) — 데모 폴백.
 */
export async function findUsername(
  emailRaw: string,
): Promise<{ ok: true; sent: boolean; usernames?: string[] } | { error: string }> {
  const email = emailRaw.trim().toLowerCase();
  if (!EMAIL_RE.test(email)) return { error: "올바른 이메일 주소를 입력하세요." };

  const members = await findByEmail(email);
  if (members.length === 0) return { error: "해당 이메일로 가입된 계정이 없습니다." };

  const usernames = members.map((m) => m.username);

  if (!isEmailConfigured()) {
    // 이메일 미설정 — 화면 표시 폴백
    return { ok: true, sent: false, usernames };
  }

  const sent = await sendMail({
    to: email,
    subject: "[GUITAR TOGETHER] 아이디 찾기 결과",
    text: `회원님의 아이디는 다음과 같습니다:\n\n${usernames.join("\n")}\n\n로그인 화면에서 위 아이디로 로그인하세요.`,
  });
  if (!sent) return { error: "이메일 발송에 실패했습니다. 관리자에게 문의하세요." };
  return { ok: true, sent: true };
}

/**
 * 비밀번호 재설정 — 아이디 + 이메일로 본인 확인 후 임시 비밀번호를 이메일로 발송.
 * - 이메일 설정 시: 임시 비밀번호를 메일로 발송(sent:true).
 * - 미설정 시: 화면에 임시 비밀번호 표시(sent:false, tempPassword) — 데모 폴백.
 */
export async function resetPassword(input: {
  username: string;
  email: string;
}): Promise<{ ok: true; sent: boolean; tempPassword?: string } | { error: string }> {
  const username = input.username.trim().toLowerCase();
  const email = input.email.trim().toLowerCase();
  if (!username || !EMAIL_RE.test(email)) return { error: "아이디와 이메일을 입력하세요." };

  const cred = await getCredential(username);
  // 본인 확인: 아이디 + 이메일 일치 (불일치 시에도 동일 메시지로 계정 노출 방지)
  if (!cred || cred.member.email.trim().toLowerCase() !== email) {
    return { error: "아이디 또는 이메일이 일치하지 않습니다." };
  }

  const tempPassword = genTempPassword();
  await setPasswordById(cred.member.id, hashPassword(tempPassword));

  if (!isEmailConfigured()) {
    return { ok: true, sent: false, tempPassword };
  }

  const sent = await sendMail({
    to: email,
    subject: "[GUITAR TOGETHER] 임시 비밀번호 안내",
    text: `요청하신 임시 비밀번호는 다음과 같습니다:\n\n임시 비밀번호: ${tempPassword}\n\n로그인 후 비밀번호를 변경해 주세요.`,
  });
  if (!sent) return { error: "이메일 발송에 실패했습니다. 관리자에게 문의하세요." };
  return { ok: true, sent: true };
}

/** 가입 승인 (STAFF 이상) */
export async function approveMember(id: string): Promise<{ ok: true } | { error: string }> {
  const session = await getSession();
  if (!can.manageMembers(session?.role)) return { error: "권한이 없습니다." };
  await setApproved(id, true);
  return { ok: true };
}

/** 가입 거절/삭제 (STAFF 이상) */
export async function rejectMember(id: string): Promise<{ ok: true } | { error: string }> {
  const session = await getSession();
  if (!can.manageMembers(session?.role)) return { error: "권한이 없습니다." };
  await removeMember(id);
  return { ok: true };
}

/** 권한 등급 변경 (STAFF 이상) */
export async function changeRole(
  id: string,
  role: MemberRole,
): Promise<{ ok: true } | { error: string }> {
  const session = await getSession();
  if (!can.manageMembers(session?.role)) return { error: "권한이 없습니다." };
  if (role === "admin") return { error: "admin 권한은 부여할 수 없습니다." };
  await setRole(id, role);
  return { ok: true };
}

/** 마이페이지 — 본인 기본정보 수정. 변경된 세션 정보를 반환(쿠키 갱신용). */
export async function updateMyProfile(input: {
  name: string;
  phone: string;
  email: string;
  part: string;
}): Promise<{ user: SessionUser } | { error: string }> {
  const session = await getSession();
  if (!session) return { error: "로그인이 필요합니다." };
  if (session.id === ADMIN_USER.id) return { error: "관리자 계정은 기본정보를 수정할 수 없습니다." };

  const name = input.name.trim();
  const phone = input.phone.trim();
  const email = input.email.trim().toLowerCase();
  const part = input.part.trim();

  if (!name) return { error: "이름을 입력하세요." };
  if (!phone) return { error: "휴대폰번호를 입력하세요." };
  if (!EMAIL_RE.test(email)) return { error: "올바른 이메일 주소를 입력하세요." };

  await setProfile(session.id, { name, phone, email, part });

  // 세션(쿠키)에 들어가는 값만 갱신 — 이름/파트/이니셜
  const user: SessionUser = {
    ...session,
    name,
    part: part || "미정",
    initial: name.charAt(0) || "?",
  };
  return { user };
}

/** 팀 배정/변경 (STAFF 이상) — teamId=null 이면 미배정 */
export async function changeTeam(
  id: string,
  teamId: string | null,
): Promise<{ ok: true } | { error: string }> {
  const session = await getSession();
  if (!can.manageMembers(session?.role)) return { error: "권한이 없습니다." };
  await setTeam(id, teamId);
  return { ok: true };
}
