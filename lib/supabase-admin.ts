import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * 서버 전용 Supabase 클라이언트 (service_role 키 — RLS 우회).
 * ⚠️ 절대 클라이언트로 노출 금지. 인증(비밀번호 검증/저장) 등 server action 에서만 사용.
 */
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

export const isAdminConfigured = Boolean(url && serviceKey);

let client: SupabaseClient | null = null;

export function getSupabaseAdmin(): SupabaseClient | null {
  if (!isAdminConfigured) return null;
  if (!client)
    client = createClient(url as string, serviceKey as string, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  return client;
}
