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
  getAllMembers,
  getCredential,
  removeMember,
  setApproved,
  setPasswordById,
  setProfile,
  setRole,
  setStatus,
  setTeam,
  usernameTaken,
} from "./member-store";
import type { MemberStatus } from "./types";
import { isEmailConfigured, sendMail, emailHtml } from "./email";
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
  team_id_2?: string | null;
}): SessionUser {
  return {
    id: m.id,
    name: m.name,
    role: m.role,
    part: m.part,
    initial: m.initial,
    team_id: m.team_id ?? null,
    team_id_2: m.team_id_2 ?? null,
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
  part2?: string;
}): Promise<{ ok: true } | { error: string }> {
  const username = input.username.trim().toLowerCase();
  const name = input.name.trim();
  const phone = input.phone.trim();
  const email = input.email.trim().toLowerCase();
  const part = input.part.trim();
  const part2 = (input.part2 ?? "").trim() || null;

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
      part2,
    });
  } catch {
    return { error: "가입 처리 중 오류가 발생했습니다. 관리자에게 문의하세요." };
  }

  // 관리자에게 가입 신청 알림 메일 (실패해도 가입은 정상 처리)
  const notifyTo = process.env.SIGNUP_NOTIFY_EMAIL ?? "junyoung70621@gmail.com";
  try {
    await sendMail({
      to: notifyTo,
      subject: "[기타투게더] 새 회원가입 신청",
      text: `새 회원가입 신청이 접수되었습니다. 관리자 승인이 필요합니다.\n\n이름: ${name}\n아이디: ${username}\n휴대폰: ${phone}\n이메일: ${email}\n파트: ${(part || "미정") + (part2 ? ` · ${part2}` : "")}`,
      html: emailHtml({
        heading: "새 회원가입 신청",
        intro: "새 가입 신청이 접수되었습니다. 관리자 승인이 필요합니다.",
        rows: [
          { label: "이름", value: name },
          { label: "아이디", value: username },
          { label: "휴대폰", value: phone },
          { label: "이메일", value: email },
          { label: "파트", value: (part || "미정") + (part2 ? ` · ${part2}` : "") },
        ],
        note: "회원 관리 화면에서 승인/거절할 수 있습니다.",
      }),
    });
  } catch {
    /* 알림 메일 실패는 무시 */
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
    subject: "[기타투게더] 아이디 찾기 결과",
    text: `회원님의 아이디는 다음과 같습니다:\n\n${usernames.join("\n")}\n\n로그인 화면에서 위 아이디로 로그인하세요.`,
    html: emailHtml({
      heading: "아이디 찾기 결과",
      intro: "요청하신 이메일로 가입된 아이디입니다.",
      highlight: { label: "아이디", value: usernames.join(", ") },
      note: "로그인 화면에서 위 아이디로 로그인하세요.",
    }),
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
    subject: "[기타투게더] 임시 비밀번호 안내",
    text: `요청하신 임시 비밀번호는 다음과 같습니다:\n\n임시 비밀번호: ${tempPassword}\n\n로그인 후 비밀번호를 변경해 주세요.`,
    html: emailHtml({
      heading: "임시 비밀번호 안내",
      intro: "아래 임시 비밀번호로 로그인한 뒤, 마이페이지에서 비밀번호를 변경해 주세요.",
      highlight: { label: "임시 비밀번호", value: tempPassword },
      note: "본인이 요청하지 않았다면 이 메일을 무시하세요.",
    }),
  });
  if (!sent) return { error: "이메일 발송에 실패했습니다. 관리자에게 문의하세요." };
  return { ok: true, sent: true };
}

/** 승인 대기 중인 가입 신청 수 (운영진만, 그 외 0) — 회원 탭 배지용 */
export async function getPendingCount(): Promise<number> {
  const session = await getSession();
  if (!can.manageMembers(session?.role)) return 0;
  const members = await getAllMembers();
  return members.filter((m) => !m.approved).length;
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

/** 마이페이지 — 본인 비밀번호 변경 (현재 비밀번호 확인 후 변경) */
export async function changeMyPassword(input: {
  currentPassword: string;
  newPassword: string;
}): Promise<{ ok: true } | { error: string }> {
  const session = await getSession();
  if (!session) return { error: "로그인이 필요합니다." };
  if (session.id === ADMIN_USER.id) return { error: "관리자 계정은 여기서 변경할 수 없습니다." };
  if (input.newPassword.length < 4) return { error: "새 비밀번호는 4자 이상이어야 합니다." };

  const members = await getAllMembers();
  const me = members.find((m) => m.id === session.id);
  if (!me) return { error: "회원 정보를 찾을 수 없습니다." };

  const cred = await getCredential(me.username);
  if (!cred || !verifyPassword(input.currentPassword, cred.passwordHash)) {
    return { error: "현재 비밀번호가 올바르지 않습니다." };
  }

  await setPasswordById(me.id, hashPassword(input.newPassword));
  return { ok: true };
}

/** 마이페이지 — 본인 기본정보 수정. 변경된 세션 정보를 반환(쿠키 갱신용). */
export async function updateMyProfile(input: {
  name: string;
  phone: string;
  email: string;
  part: string;
  part2?: string;
}): Promise<{ user: SessionUser } | { error: string }> {
  const session = await getSession();
  if (!session) return { error: "로그인이 필요합니다." };
  if (session.id === ADMIN_USER.id) return { error: "관리자 계정은 기본정보를 수정할 수 없습니다." };

  const name = input.name.trim();
  const phone = input.phone.trim();
  const email = input.email.trim().toLowerCase();
  const part = input.part.trim();
  const part2 = (input.part2 ?? "").trim() || null;

  if (!name) return { error: "이름을 입력하세요." };
  if (!phone) return { error: "휴대폰번호를 입력하세요." };
  if (!EMAIL_RE.test(email)) return { error: "올바른 이메일 주소를 입력하세요." };
  if (part2 && part2 === part) return { error: "악기 2는 악기 1과 다른 악기를 선택하세요." };

  await setProfile(session.id, { name, phone, email, part, part2 });

  // 세션(쿠키)에 들어가는 값만 갱신 — 이름/파트/이니셜
  const user: SessionUser = {
    ...session,
    name,
    part: part || "미정",
    initial: name.charAt(0) || "?",
  };
  return { user };
}

/** 회원 상태 변경 (STAFF 이상) — 활동중(active) / 휴식(rest) */
export async function changeStatus(
  id: string,
  status: MemberStatus,
): Promise<{ ok: true } | { error: string }> {
  const session = await getSession();
  if (!can.manageMembers(session?.role)) return { error: "권한이 없습니다." };
  if (status !== "active" && status !== "rest") return { error: "잘못된 상태입니다." };
  await setStatus(id, status);
  return { ok: true };
}

/** 강퇴 = 계정 삭제 (STAFF 이상). 아이디가 비워져 재가입 가능. */
export async function kickMember(id: string): Promise<{ ok: true } | { error: string }> {
  const session = await getSession();
  if (!can.manageMembers(session?.role)) return { error: "권한이 없습니다." };
  if (session?.id === id) return { error: "본인 계정은 강퇴할 수 없습니다." };
  await removeMember(id);
  return { ok: true };
}

/** 팀 배정/변경 (STAFF 이상) — slot 1=팀1, slot 2=팀2. teamId=null 이면 해당 슬롯 해제 */
export async function changeTeam(
  id: string,
  teamId: string | null,
  slot: 1 | 2 = 1,
): Promise<{ ok: true } | { error: string }> {
  const session = await getSession();
  if (!can.manageMembers(session?.role)) return { error: "권한이 없습니다." };
  if (slot !== 1 && slot !== 2) return { error: "잘못된 팀 슬롯입니다." };

  // 두 슬롯에 같은 팀을 중복 배정하지 못하게 (한 팀에 한 번만)
  if (teamId) {
    const members = await getAllMembers();
    const target = members.find((m) => m.id === id);
    const otherTeam = slot === 2 ? target?.team_id : target?.team_id_2;
    if (otherTeam && otherTeam === teamId) {
      return { error: "이미 다른 슬롯에 배정된 팀입니다. 서로 다른 팀을 선택하세요." };
    }
  }

  await setTeam(id, teamId, slot);
  return { ok: true };
}
