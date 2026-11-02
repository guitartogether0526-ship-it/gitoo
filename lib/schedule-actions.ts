"use server";

import { can } from "./roles";
import { getSession } from "./session";
import { getSupabaseAdmin } from "./supabase-admin";
import type { ScheduleRow } from "./db";

const MAX_ROWS = 8;
const MAX_LEN = 60;

/** 월별 일정 저장 — 운영진 전용. app_settings(key='schedule:YYYY-MM') upsert. 빈 행은 버린다. */
export async function saveSchedule(ym: string, input: unknown): Promise<{ ok: true } | { error: string }> {
  const session = await getSession();
  if (!can.manageMembers(session?.role)) return { error: "권한이 없습니다. (운영진 전용)" };
  if (!/^\d{4}-\d{2}$/.test(ym)) return { error: "잘못된 월입니다." };
  if (!Array.isArray(input) || input.length > MAX_ROWS) return { error: "잘못된 데이터입니다." };
  const rows: ScheduleRow[] = [];
  for (const r of input) {
    if (!r || typeof r !== "object") return { error: "잘못된 데이터입니다." };
    const o = r as Record<string, unknown>;
    const pick = (k: string) => (typeof o[k] === "string" ? (o[k] as string).trim().slice(0, MAX_LEN) : "");
    const row = { date: pick("date"), topic: pick("topic"), detail: pick("detail") };
    if (row.date || row.topic || row.detail) rows.push(row);
  }
  const sb = getSupabaseAdmin();
  if (!sb) return { error: "Supabase 미연결 — 저장할 수 없습니다." };
  const { error } = await sb
    .from("app_settings")
    .upsert({ key: `schedule:${ym}`, value: rows, updated_at: new Date().toISOString() });
  if (error) return { error: "저장 실패(schema.sql의 app_settings 테이블이 필요합니다): " + error.message };
  return { ok: true };
}
