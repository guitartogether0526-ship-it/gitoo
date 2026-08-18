"use server";

import { randomUUID } from "node:crypto";
import { type Team, type TeamCategory, TEAM_CATEGORIES } from "./types";
import { can } from "./roles";
import { getSession } from "./session";
import { getSupabaseAdmin } from "./supabase-admin";

const MAX_NAME = 30;

/** 이름·페이지 구분 공통 검증 — 통과하면 정리된 이름, 아니면 오류 메시지 */
function checkTeam(nameRaw: string, category: TeamCategory): { name: string } | { error: string } {
  const name = nameRaw.trim();
  if (!name) return { error: "팀 이름을 입력하세요." };
  if (name.length > MAX_NAME) return { error: `팀 이름은 ${MAX_NAME}자 이하로 입력하세요.` };
  if (!TEAM_CATEGORIES.includes(category)) return { error: "잘못된 페이지 구분입니다." };
  return { name };
}

/** 팀 추가 — 운영진(회장·총무·STAFF, admin) 전용. category = 소속 페이지(정기공연/재롱페스티벌) */
export async function addTeam(
  nameRaw: string,
  category: TeamCategory = "정기공연",
): Promise<{ team: Team } | { error: string }> {
  const session = await getSession();
  if (!can.manageTeams(session?.role)) return { error: "권한이 없습니다. (운영진 전용)" };

  const checked = checkTeam(nameRaw, category);
  if ("error" in checked) return checked;

  const id = randomUUID();
  const sb = getSupabaseAdmin();
  if (sb) {
    // 맨 뒤 순서로 추가 (기존 최대 sort_order + 1)
    let next = 0;
    const { data: ex, error: exErr } = await sb.from("teams").select("sort_order");
    if (!exErr && ex) next = Math.max(0, ...ex.map((t) => (t as Team).sort_order ?? 0)) + 1;

    // 컬럼 없이 재시도하지 않는다 — 조용히 성공하면 category 가 빠진 채 엉뚱한 페이지에 들어간다
    const res = await sb
      .from("teams")
      .insert({ id, name: checked.name, sort_order: next, category })
      .select()
      .single();
    if (res.error)
      return {
        error: "팀 추가 실패(스키마에 sort_order·category 컬럼이 필요합니다): " + res.error.message,
      };
    return { team: res.data as Team };
  }
  // Supabase 미설정 — 비영구(메모리) 폴백. 곡 추가와 동일하게 화면 상태로만 반영.
  return { team: { id, name: checked.name, category } };
}

/**
 * 팀 이름·페이지 구분·순서 일괄 저장 — 운영진 전용.
 * 배열 순서가 곧 sort_order(0,1,2…). 한 번의 upsert 로 처리한다.
 */
export async function saveTeams(
  rows: { id: string; name: string; category: TeamCategory }[],
): Promise<{ ok: true } | { error: string }> {
  const session = await getSession();
  if (!can.manageTeams(session?.role)) return { error: "권한이 없습니다. (운영진 전용)" };

  const payload = [];
  for (let i = 0; i < rows.length; i++) {
    const checked = checkTeam(rows[i].name, rows[i].category);
    if ("error" in checked) return checked;
    payload.push({ id: rows[i].id, name: checked.name, category: rows[i].category, sort_order: i });
  }

  const sb = getSupabaseAdmin();
  if (sb && payload.length) {
    const { error } = await sb.from("teams").upsert(payload);
    if (error)
      return { error: "팀 저장 실패(스키마에 sort_order·category 컬럼이 필요합니다): " + error.message };
  }
  return { ok: true };
}

/** 팀 삭제 — 운영진 전용. 해당 팀 곡은 함께 삭제되고, 팀원은 미배정으로 바뀝니다. */
export async function deleteTeam(id: string): Promise<{ ok: true } | { error: string }> {
  const session = await getSession();
  if (!can.manageTeams(session?.role)) return { error: "권한이 없습니다. (운영진 전용)" };

  const sb = getSupabaseAdmin();
  if (sb) {
    // songs.team_id는 on delete cascade, members.team_id(_2,_3)는 on delete set null — DB가 정리한다
    const { error } = await sb.from("teams").delete().eq("id", id);
    if (error) return { error: "팀 삭제 실패: " + error.message };
  }
  return { ok: true };
}
