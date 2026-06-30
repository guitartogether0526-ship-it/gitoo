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
    const { data, error } = await sb.from("teams").insert({ id, name }).select().single();
    if (error) return { error: "팀 추가에 실패했습니다: " + error.message };
    return { team: data as Team };
  }
  // Supabase 미설정 — 비영구(메모리) 폴백. 곡 추가와 동일하게 화면 상태로만 반영.
  return { team: { id, name } };
}
