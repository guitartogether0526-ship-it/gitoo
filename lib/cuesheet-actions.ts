"use server";

import { redirect } from "next/navigation";
import { can } from "./roles";
import { getSession } from "./session";
import { getSupabaseAdmin } from "./supabase-admin";
import { getTeams } from "./db";
import { isCueId, normalizeCuesheetLoose, normalizeTeamCue, type TeamCue } from "./cuesheet";

type Res = { ok: true } | { error: string };
const DENIED = { error: "권한이 없습니다. (운영진 전용)" };
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

async function staff() {
  const session = await getSession();
  return can.manageMembers(session?.role);
}

/** 새 큐시트 — 제목·날짜만 저장하고 편집 화면으로 */
export async function createCuesheet(formData: FormData): Promise<void> {
  if (!(await staff())) return;
  const title = String(formData.get("title") ?? "").trim().slice(0, 60);
  const date = String(formData.get("date") ?? "");
  if (!title || !DATE_RE.test(date)) return;
  const sb = getSupabaseAdmin();
  if (!sb) return;
  const id = crypto.randomUUID();
  const { error } = await sb
    .from("app_settings")
    .insert({ key: `cuesheet:${id}`, value: { title, date, teams: {} }, updated_at: new Date().toISOString() });
  if (error) throw new Error("큐시트 생성 실패: " + error.message);
  redirect(`/cuesheet?id=${id}`);
}

/**
 * 저장 — 바뀐 팀만 받아 최신 저장본에 병합한다.
 * 리허설 때 운영진 둘이 서로 다른 팀을 기록해도 서로 덮어쓰지 않는다. (같은 팀을 동시에 고치면 나중 저장이 남음)
 */
export async function saveCuesheet(
  id: string,
  header: { title: unknown; date: unknown },
  changed: Record<string, unknown>,
): Promise<Res> {
  if (!(await staff())) return DENIED;
  if (!isCueId(id)) return { error: "잘못된 큐시트입니다." };
  const title = typeof header.title === "string" ? header.title.trim().slice(0, 60) : "";
  const date = typeof header.date === "string" ? header.date : "";
  if (!title || !DATE_RE.test(date)) return { error: "공연 이름과 날짜를 입력하세요." };

  const teamIds = new Set((await getTeams()).map((t) => t.id));
  const teams: Record<string, TeamCue> = {};
  for (const [tid, raw] of Object.entries(changed ?? {})) {
    const t = normalizeTeamCue(raw);
    if (!teamIds.has(tid) || !t) return { error: "잘못된 데이터입니다." };
    teams[tid] = t;
  }

  const sb = getSupabaseAdmin();
  if (!sb) return { error: "Supabase 미연결 — 저장할 수 없습니다." };
  const cur = await sb.from("app_settings").select("value").eq("key", `cuesheet:${id}`).maybeSingle();
  if (cur.error) return { error: "저장 실패: " + cur.error.message };
  if (!cur.data) return { error: "다른 운영진이 삭제한 큐시트입니다." };
  const base = normalizeCuesheetLoose(cur.data.value);
  const { error } = await sb.from("app_settings").upsert({
    key: `cuesheet:${id}`,
    value: { title, date, teams: { ...base.teams, ...teams } },
    updated_at: new Date().toISOString(),
  });
  if (error) return { error: "저장 실패: " + error.message };
  return { ok: true };
}

export async function deleteCuesheet(id: string): Promise<Res> {
  if (!(await staff())) return DENIED;
  if (!isCueId(id)) return { error: "잘못된 큐시트입니다." };
  const sb = getSupabaseAdmin();
  if (!sb) return { error: "Supabase 미연결" };
  const { error } = await sb.from("app_settings").delete().eq("key", `cuesheet:${id}`);
  if (error) return { error: "삭제 실패: " + error.message };
  return { ok: true };
}
