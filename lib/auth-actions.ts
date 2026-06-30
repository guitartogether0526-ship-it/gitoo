"use server";

import type { SessionUser } from "./types";
import { ADMIN_USER } from "./admin";

/**
 * 관리자 비밀번호 검증 (서버 전용 — 비밀번호가 클라이언트 번들에 포함되지 않음).
 * 운영 시 Vercel/.env 의 ADMIN_PASSWORD 로 덮어쓰세요. 미설정 시 기본값 사용.
 */
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD ?? "<admin-password>";

export async function loginAdmin(password: string): Promise<SessionUser | null> {
  if (password === ADMIN_PASSWORD) return ADMIN_USER;
  return null;
}
