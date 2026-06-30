"use server";

import type { SessionUser } from "./types";
import { ADMIN_USER } from "./admin";
import { can } from "./roles";
import { getSession } from "./session";
import { hashPassword, verifyPassword } from "./password";
import type { MemberRole } from "./types";
import {
  createMember,
  findByNameCohort,
  getCredential,
  removeMember,
  setApproved,
  setPasswordByUsername,
  setRole,
  usernameTaken,
} from "./member-store";

/** 관리자 비밀번호 (서버 전용). Vercel/.env 의 ADMIN_PASSWORD 로 덮어쓰기. */
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD ?? "<admin-password>";
const ADMIN_USERNAME = "admin";

type LoginResult = { user: SessionUser } | { error: string };

function toSession(m: {
  id: string;
  name: string;
  role: SessionUser["role"];
  part: string;
  cohort: number;
  initial: string;
}): SessionUser {
  return { id: m.id, name: m.name, role: m.role, part: m.part, cohort: m.cohort, initial: m.initial };
}

/** 로그인 — 아이디 + 비밀번호 */
export async function login(usernameRaw: string, password: string): Promise<LoginResult> {
  const username = usernameRaw.trim().toLowerCase();
  if (!username || !password) return { error: "아이디와 비밀번호를 입력하세요." };

  // 관리자 계정
  if (username === ADMIN_USERNAME) {
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
  cohort: number;
  part: string;
}): Promise<{ ok: true } | { error: string }> {
  const username = input.username.trim().toLowerCase();
  const name = input.name.trim();
  const part = input.part.trim();

  if (!username || !input.password || !name) return { error: "필수 항목을 모두 입력하세요." };
  if (username === ADMIN_USERNAME) return { error: "사용할 수 없는 아이디입니다." };
  if (!/^[a-z0-9_]{3,20}$/.test(username))
    return { error: "아이디는 영문 소문자·숫자·_ 3~20자로 입력하세요." };
  if (input.password.length < 4) return { error: "비밀번호는 4자 이상이어야 합니다." };
  if (!Number.isFinite(input.cohort) || input.cohort <= 0) return { error: "기수를 입력하세요." };

  if (await usernameTaken(username)) return { error: "이미 사용 중인 아이디입니다." };

  try {
    await createMember({
      username,
      passwordHash: hashPassword(input.password),
      name,
      cohort: input.cohort,
      part: part || "미정",
    });
  } catch {
    return { error: "가입 처리 중 오류가 발생했습니다. 관리자에게 문의하세요." };
  }
  return { ok: true };
}

/** 아이디 찾기 — 이름 + 기수로 조회 */
export async function findUsername(
  name: string,
  cohort: number,
): Promise<{ usernames: string[] } | { error: string }> {
  if (!name.trim() || !Number.isFinite(cohort)) return { error: "이름과 기수를 입력하세요." };
  const members = await findByNameCohort(name, cohort);
  if (members.length === 0) return { error: "일치하는 회원이 없습니다." };
  return { usernames: members.map((m) => m.username) };
}

/** 비밀번호 재설정 — 아이디 + 이름 + 기수로 본인 확인 후 새 비밀번호 설정 */
export async function resetPassword(input: {
  username: string;
  name: string;
  cohort: number;
  newPassword: string;
}): Promise<{ ok: true } | { error: string }> {
  if (input.newPassword.length < 4) return { error: "비밀번호는 4자 이상이어야 합니다." };
  const ok = await setPasswordByUsername(
    input.username.trim().toLowerCase(),
    input.name,
    input.cohort,
    hashPassword(input.newPassword),
  );
  if (!ok) return { error: "본인 확인에 실패했습니다. 아이디·이름·기수를 확인하세요." };
  return { ok: true };
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
