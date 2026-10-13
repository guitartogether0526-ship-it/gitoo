"use server";

import { can } from "./roles";
import { getSession } from "./session";
import { getSupabaseAdmin } from "./supabase-admin";
import { normalizeSoundGuide } from "./sound-guide-data";

/** 배치도 · 모니터 앰프 표 저장 — 운영진 전용. app_settings(key='sound_guide') upsert */
export async function saveSoundGuide(input: unknown): Promise<{ ok: true } | { error: string }> {
  const session = await getSession();
  if (!can.manageMembers(session?.role)) return { error: "권한이 없습니다. (운영진 전용)" };
  const data = normalizeSoundGuide(input);
  if (!data) return { error: "잘못된 데이터입니다." };
  const sb = getSupabaseAdmin();
  if (!sb) return { error: "Supabase 미연결 — 저장할 수 없습니다." };
  const { error } = await sb
    .from("app_settings")
    .upsert({ key: "sound_guide", value: data, updated_at: new Date().toISOString() });
  if (error) return { error: "저장 실패(schema.sql의 app_settings 테이블이 필요합니다): " + error.message };
  return { ok: true };
}
