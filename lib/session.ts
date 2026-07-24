import { cookies } from "next/headers";
import { createHmac, timingSafeEqual } from "node:crypto";
import type { SessionUser } from "./types";
import { SESSION_COOKIE } from "./session-cookie";

/**
 * 로그인 세션 쿠키 — HMAC 서명으로 위조 방지.
 *
 * 값 형식: base64url(JSON) + "." + HMAC-SHA256 서명.
 * 쿠키는 로그인/프로필 수정 서버 액션이 서명해 설정하고, 서버는 서명이
 * 맞을 때만 신뢰한다. 서명이 없거나 틀리면(직접 만든 쿠키·구버전 쿠키) 비로그인 취급.
 */

// 서명 키 — 전용 SESSION_SECRET이 없으면 이미 서버에만 있는 비밀값을 재사용.
// 셋 다 없는 환경(로컬 순수 데모 모드)에서만 빈 키가 된다.
const SECRET =
  process.env.SESSION_SECRET ??
  process.env.SUPABASE_SERVICE_ROLE_KEY ??
  process.env.ADMIN_PASSWORD ??
  "";

const sign = (payload: string) =>
  createHmac("sha256", SECRET).update(payload).digest("base64url");

/** 세션을 서명된 쿠키로 저장 — 서버 액션에서만 호출할 것 (서버 컴포넌트에선 쿠키 설정 불가) */
export async function setSessionCookie(user: SessionUser): Promise<void> {
  const payload = Buffer.from(JSON.stringify(user)).toString("base64url");
  const store = await cookies();
  store.set(SESSION_COOKIE, `${payload}.${sign(payload)}`, {
    path: "/",
    maxAge: 60 * 60 * 24 * 30, // 30일
    sameSite: "lax",
  });
}

/** 서버 컴포넌트/액션에서 로그인 세션 읽기 — 서명 검증 실패 시 null */
export async function getSession(): Promise<SessionUser | null> {
  const store = await cookies();
  const raw = store.get(SESSION_COOKIE)?.value;
  if (!raw) return null;
  const dot = raw.lastIndexOf(".");
  if (dot < 0) return null;
  const payload = raw.slice(0, dot);
  try {
    const a = Buffer.from(raw.slice(dot + 1));
    const b = Buffer.from(sign(payload));
    if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
    return JSON.parse(Buffer.from(payload, "base64url").toString()) as SessionUser;
  } catch {
    return null;
  }
}
