"use server";

import { revalidateTag } from "next/cache";
import { can } from "./roles";
import { getSession } from "./session";
import { getSupabaseAdmin } from "./supabase-admin";
import { normalizeSoundGuide } from "./sound-guide-data";

/**
 * 배치도 · 모니터 앰프 표 · 문장 저장 — 운영진 전용. app_settings(key='sound_guide') upsert.
 * expectedUpdatedAt: 편집 페이지가 로드했을 때의 updated_at. 그 사이 다른 운영진이 저장했으면 거부(덮어쓰기 방지).
 */
export async function saveSoundGuide(
  input: unknown,
  expectedUpdatedAt: string | null,
): Promise<{ ok: true } | { error: string }> {
  const session = await getSession();
  if (!can.manageMembers(session?.role)) return { error: "권한이 없습니다. (운영진 전용)" };
  const data = normalizeSoundGuide(input);
  if (!data) return { error: "잘못된 데이터입니다." };
  const sb = getSupabaseAdmin();
  if (!sb) return { error: "Supabase 미연결 — 저장할 수 없습니다." };

  const cur = await sb.from("app_settings").select("updated_at").eq("key", "sound_guide").maybeSingle();
  if (cur.error) return { error: "저장 실패(schema.sql의 app_settings 테이블이 필요합니다): " + cur.error.message };
  const curAt = cur.data?.updated_at ?? null;
  if (curAt !== expectedUpdatedAt)
    return { error: "그 사이 다른 운영진이 저장했습니다. 페이지를 새로고침해 최신 내용에서 다시 수정하세요." };

  const { error } = await sb
    .from("app_settings")
    .upsert({ key: "sound_guide", value: data, updated_at: new Date().toISOString() });
  if (error) return { error: "저장 실패: " + error.message };
  revalidateTag("sound-guide");
  return { ok: true };
}
