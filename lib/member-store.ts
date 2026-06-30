import "server-only";
import { randomUUID } from "node:crypto";
import type { Member } from "./types";
import { getSupabaseAdmin } from "./supabase-admin";

/**
 * 회원 + 자격증명(비밀번호) 저장소 — 서버 전용.
 *
 * - Supabase(service_role) 가 있으면: members(공개) + member_auth(비공개, 비밀번호) 테이블 사용.
 *   비밀번호는 member_auth 에만 있고 RLS 로 anon 접근 차단 → 클라이언트로 절대 노출되지 않음.
 * - 미설정 시: 프로세스 메모리 폴백(재시작 시 초기화) — DB 없이도 데모 동작.
 */

const MEMBER_COLS = "id,name,cohort,part,status,role,initial,username,approved";

// ---- 메모리 폴백 ----
type MemRecord = Member & { password: string };
const mem: { rows: MemRecord[] } = { rows: [] };
const strip = (r: MemRecord): Member => {
  const { password: _pw, ...rest } = r;
  return rest;
};

export async function getAllMembers(): Promise<Member[]> {
  const sb = getSupabaseAdmin();
  if (sb) {
    const { data } = await sb.from("members").select(MEMBER_COLS);
    return (data as Member[] | null) ?? [];
  }
  return mem.rows.map(strip);
}

export async function usernameTaken(username: string): Promise<boolean> {
  const u = username.toLowerCase();
  const sb = getSupabaseAdmin();
  if (sb) {
    const { data } = await sb.from("members").select("id").eq("username", u).limit(1);
    return !!data && data.length > 0;
  }
  return mem.rows.some((r) => r.username.toLowerCase() === u);
}

export async function createMember(input: {
  username: string;
  passwordHash: string;
  name: string;
  cohort: number;
  part: string;
}): Promise<Member> {
  const id = randomUUID();
  const member: Member = {
    id,
    name: input.name,
    cohort: input.cohort,
    part: input.part,
    status: "active",
    role: "member",
    initial: input.name.trim().charAt(0) || "?",
    username: input.username.toLowerCase(),
    approved: false, // 관리자 승인 대기
  };

  const sb = getSupabaseAdmin();
  if (sb) {
    const { error: mErr } = await sb.from("members").insert(member);
    if (mErr) throw new Error(mErr.message);
    const { error: aErr } = await sb
      .from("member_auth")
      .insert({ member_id: id, password: input.passwordHash });
    if (aErr) {
      // 자격증명 저장 실패 시 회원 행 롤백
      await sb.from("members").delete().eq("id", id);
      throw new Error(aErr.message);
    }
  } else {
    mem.rows.push({ ...member, password: input.passwordHash });
  }
  return member;
}

export async function getCredential(
  username: string,
): Promise<{ member: Member; passwordHash: string } | null> {
  const u = username.toLowerCase();
  const sb = getSupabaseAdmin();
  if (sb) {
    const { data: m } = await sb.from("members").select(MEMBER_COLS).eq("username", u).maybeSingle();
    if (!m) return null;
    const { data: a } = await sb
      .from("member_auth")
      .select("password")
      .eq("member_id", (m as Member).id)
      .maybeSingle();
    if (!a) return null;
    return { member: m as Member, passwordHash: (a as { password: string }).password };
  }
  const row = mem.rows.find((r) => r.username.toLowerCase() === u);
  return row ? { member: strip(row), passwordHash: row.password } : null;
}

export async function findByNameCohort(name: string, cohort?: number): Promise<Member[]> {
  const n = name.trim();
  const sb = getSupabaseAdmin();
  if (sb) {
    let q = sb.from("members").select(MEMBER_COLS).eq("name", n);
    if (typeof cohort === "number") q = q.eq("cohort", cohort);
    const { data } = await q;
    return (data as Member[] | null) ?? [];
  }
  return mem.rows
    .filter((r) => r.name === n && (cohort === undefined || r.cohort === cohort))
    .map(strip);
}

export async function setApproved(id: string, approved: boolean): Promise<void> {
  const sb = getSupabaseAdmin();
  if (sb) {
    await sb.from("members").update({ approved }).eq("id", id);
    return;
  }
  const row = mem.rows.find((r) => r.id === id);
  if (row) row.approved = approved;
}

export async function setRole(id: string, role: Member["role"]): Promise<void> {
  const sb = getSupabaseAdmin();
  if (sb) {
    await sb.from("members").update({ role }).eq("id", id);
    return;
  }
  const row = mem.rows.find((r) => r.id === id);
  if (row) row.role = role;
}

export async function removeMember(id: string): Promise<void> {
  const sb = getSupabaseAdmin();
  if (sb) {
    await sb.from("member_auth").delete().eq("member_id", id);
    await sb.from("members").delete().eq("id", id);
    return;
  }
  mem.rows = mem.rows.filter((r) => r.id !== id);
}

export async function setPasswordByUsername(
  username: string,
  name: string,
  cohort: number,
  passwordHash: string,
): Promise<boolean> {
  const cred = await getCredential(username);
  if (!cred) return false;
  // 본인 확인: 이름 + 기수 일치
  if (cred.member.name !== name.trim() || cred.member.cohort !== cohort) return false;

  const sb = getSupabaseAdmin();
  if (sb) {
    await sb.from("member_auth").update({ password: passwordHash }).eq("member_id", cred.member.id);
    return true;
  }
  const row = mem.rows.find((r) => r.id === cred.member.id);
  if (row) row.password = passwordHash;
  return true;
}
