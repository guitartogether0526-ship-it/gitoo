"use server";

import { randomUUID } from "node:crypto";
import type { Team } from "./types";
import { can } from "./roles";
import { getSession } from "./session";
import { getSupabaseAdmin } from "./supabase-admin";

/** 팀 추가 — 운영진(회장·총무·STAFF, admin) 전용 */
export async function addTeam(nameRaw: string): Promise<{ team: Team } | { error: string }> {
  const session = await getSession();
  if (!can.manageTeams(session?.role)) return { error: "권한이 없습니다. (운영진 전용)" };

  const name = nameRaw.trim();
  if (!name) return { error: "팀 이름을 입력하세요." };
  if (name.length > 30) return { error: "팀 이름은 30자 이하로 입력하세요." };

  const id = randomUUID();
  const sb = getSupabaseAdmin();
  if (sb) {
    // 맨 뒤 순서로 추가 (기존 최대 sort_order + 1)
    let next = 0;
    const { data: ex, error: exErr } = await sb.from("teams").select("sort_order");
    if (!exErr && ex) next = Math.max(0, ...ex.map((t) => (t as Team).sort_order ?? 0)) + 1;

    // sort_order 컬럼이 아직 없을 수 있어 실패 시 컬럼 없이 재시도
    let res = await sb.from("teams").insert({ id, name, sort_order: next }).select().single();
    if (res.error) res = await sb.from("teams").insert({ id, name }).select().single();
    if (res.error) return { error: "팀 추가에 실패했습니다: " + res.error.message };
    return { team: res.data as Team };
  }
  // Supabase 미설정 — 비영구(메모리) 폴백. 곡 추가와 동일하게 화면 상태로만 반영.
  return { team: { id, name } };
}

/** 팀 순서 변경 — 운영진 전용. orderedIds 순서대로 sort_order(0,1,2…) 저장 */
export async function reorderTeams(
  orderedIds: string[],
): Promise<{ ok: true } | { error: string }> {
  const session = await getSession();
  if (!can.manageTeams(session?.role)) return { error: "권한이 없습니다. (운영진 전용)" };

  const sb = getSupabaseAdmin();
  if (sb) {
    for (let i = 0; i < orderedIds.length; i++) {
      const { error } = await sb.from("teams").update({ sort_order: i }).eq("id", orderedIds[i]);
      if (error) return { error: "순서 저장 실패(스키마에 sort_order 컬럼이 필요합니다): " + error.message };
    }
  }
  return { ok: true };
}
