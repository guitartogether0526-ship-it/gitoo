import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * Supabase 클라이언트 (anon 키 — 공개 키, 서버/브라우저 공용).
 *
 * - NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY 가 설정되어 있으면 실제 DB 연결.
 * - 설정이 없으면 null 을 반환 → lib/db.ts 가 목업 데이터로 폴백한다.
 *   (로컬에서 .env 없이도, 또 테이블 생성 전에도 앱이 그대로 동작)
 *
 * ⚠️ service_role 키는 절대 여기서 쓰지 않는다 (브라우저로 새어나감).
 *    서버 전용 관리 작업이 필요할 때만 별도 server-only 모듈에서 사용할 것.
 */
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export const isSupabaseConfigured = Boolean(url && anonKey);

let client: SupabaseClient | null = null;

export function getSupabase(): SupabaseClient | null {
  if (!isSupabaseConfigured) return null;
  if (!client) client = createClient(url as string, anonKey as string);
  return client;
}
