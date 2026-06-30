import { cookies } from "next/headers";
import type { SessionUser } from "./types";
import { SESSION_COOKIE } from "./session-cookie";

/** 서버 컴포넌트에서 로그인 세션 읽기 (쿠키 기반) */
export async function getSession(): Promise<SessionUser | null> {
  const store = await cookies();
  const raw = store.get(SESSION_COOKIE)?.value;
  if (!raw) return null;
  try {
    return JSON.parse(decodeURIComponent(raw)) as SessionUser;
  } catch {
    return null;
  }
}
