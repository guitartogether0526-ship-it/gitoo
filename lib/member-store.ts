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

// ⚠️ members 는 select("*") 로 읽는다. 컬럼을 하나하나 나열하면, 스키마에 새 컬럼
//    (예: team_id_2)이 아직 없을 때(schema.sql 재실행 전) 쿼리 전체가 실패해
//    회원 목록·로그인이 통째로 비어버린다. "*" 는 존재하는 컬럼만 돌려줘 스키마 드리프트에 견고.

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
    const { data, error } = await sb.from("members").select("*");
    if (error) {
      // 보통 스키마 미반영(예: phone/email/team_id 컬럼 없음). schema.sql 재실행 필요.
      console.error("[member-store] members 조회 실패 — supabase/schema.sql 을 다시 실행하세요:", error.message);
      return [];
    }
    return (data as Member[] | null) ?? [];
  }
  return mem.rows.map(strip);
}

/** 회원 1명 조회 — 전체 명단이 필요 없는 화면에서 쓴다. 없으면 null. */
export async function getMemberById(id: string): Promise<Member | null> {
  const sb = getSupabaseAdmin();
  if (sb) {
    const { data } = await sb.from("members").select("*").eq("id", id).maybeSingle();
    return (data as Member | null) ?? null;
  }
  const row = mem.rows.find((r) => r.id === id);
  return row ? strip(row) : null;
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
  phone: string;
  email: string;
  part: string;
  part2?: string | null;
}): Promise<Member> {
  const id = randomUUID();
  const member: Member = {
    id,
    name: input.name,
    phone: input.phone,
    email: input.email,
    part: input.part,
    part2: input.part2 || null,
    part3: null,
    status: "active",
    role: "member",
    initial: input.name.trim().charAt(0) || "?",
    username: input.username.toLowerCase(),
    approved: false, // 관리자 승인 대기
    team_id: null, // 팀1 미배정 (운영진이 배정)
    team_id_2: null, // 팀2 없음
    team_id_3: null, // 팀3 없음
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
    const { data: m } = await sb.from("members").select("*").eq("username", u).maybeSingle();
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

export async function findByEmail(email: string): Promise<Member[]> {
  const e = email.trim().toLowerCase();
  const sb = getSupabaseAdmin();
  if (sb) {
    // eq 사용 — ilike는 입력의 %·_가 와일드카드로 동작해 "%@gmail.com"으로 전 회원이 걸린다
    const { data } = await sb.from("members").select("*").eq("email", e);
    return (data as Member[] | null) ?? [];
  }
  return mem.rows.filter((r) => r.email.trim().toLowerCase() === e).map(strip);
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

/** 본인 기본정보 수정 (이름·휴대폰·이메일·악기1~3). 아바타 이니셜은 이름에서 재계산. */
export async function setProfile(
  id: string,
  input: {
    name: string;
    phone: string;
    email: string;
    part: string;
    part2?: string | null;
    part3?: string | null;
  },
): Promise<void> {
  const initial = input.name.trim().charAt(0) || "?";
  const patch = {
    name: input.name.trim(),
    phone: input.phone.trim(),
    email: input.email.trim().toLowerCase(),
    part: input.part.trim() || "미정",
    part2: input.part2?.trim() || null,
    part3: input.part3?.trim() || null,
    initial,
  };
  const sb = getSupabaseAdmin();
  if (sb) {
    await sb.from("members").update(patch).eq("id", id);
    return;
  }
  const row = mem.rows.find((r) => r.id === id);
  if (row) Object.assign(row, patch);
}

export async function setStatus(id: string, status: Member["status"]): Promise<void> {
  const sb = getSupabaseAdmin();
  if (sb) {
    await sb.from("members").update({ status }).eq("id", id);
    return;
  }
  const row = mem.rows.find((r) => r.id === id);
  if (row) row.status = status;
}

/** 팀 배정 — slot 1=team_id, 2=team_id_2, 3=team_id_3 (최대 3개 팀). null=해제 */
export async function setTeam(
  id: string,
  teamId: string | null,
  slot: 1 | 2 | 3 = 1,
): Promise<void> {
  const col = (slot === 1 ? "team_id" : `team_id_${slot}`) as "team_id" | "team_id_2" | "team_id_3";
  const sb = getSupabaseAdmin();
  if (sb) {
    await sb.from("members").update({ [col]: teamId }).eq("id", id);
    return;
  }
  const row = mem.rows.find((r) => r.id === id);
  if (row) row[col] = teamId;
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

/** member_auth 비밀번호 해시 갱신 (id 기준). 본인 확인은 호출부 책임. */
export async function setPasswordById(id: string, passwordHash: string): Promise<void> {
  const sb = getSupabaseAdmin();
  if (sb) {
    await sb.from("member_auth").update({ password: passwordHash }).eq("member_id", id);
    return;
  }
  const row = mem.rows.find((r) => r.id === id);
  if (row) row.password = passwordHash;
}
