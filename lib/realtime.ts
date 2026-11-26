import "server-only";
import { after } from "next/server";
import { getSupabaseAdmin } from "./supabase-admin";
import { LIVE_CHANNEL } from "./live";

async function send(table: string): Promise<void> {
  const sb = getSupabaseAdmin();
  if (!sb) return;
  const ch = sb.channel(LIVE_CHANNEL, { config: { private: true } });
  try {
    await ch.httpSend("changed", { t: table }, { timeout: 3000 });
  } catch (e) {
    // 실패해도 저장 결과에는 영향 없음 — 다음 화면 이동·앱 복귀 때 갱신된다
    console.error("[realtime] 방송 실패:", e instanceof Error ? e.message : e);
  } finally {
    await sb.removeChannel(ch);
  }
}

/**
 * 서버 저장 직후 "이 테이블이 바뀌었음" 방송 (Supabase Realtime REST, 비공개 채널).
 * 데이터는 싣지 않는다 — 받은 화면이 각자 권한대로 다시 불러온다.
 * 저장 응답을 기다리게 하지 않도록 응답을 보낸 뒤에 보낸다(Next after — Vercel에선 waitUntil).
 */
export function notifyChanged(table: string): void {
  try {
    after(() => send(table));
  } catch {
    void send(table); // 요청 밖에서 불린 경우(스크립트 등)
  }
}
