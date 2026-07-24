"use client";

import { createContext, useCallback, useContext, useState } from "react";
import { useRouter } from "next/navigation";
import type { SessionUser } from "./types";
import { SESSION_COOKIE } from "./session-cookie";

type AuthContextValue = {
  user: SessionUser | null;
  login: (user: SessionUser) => void;
  logout: () => void;
};

const AuthContext = createContext<AuthContextValue | null>(null);

// 세션 쿠키 설정은 서버 액션(login·updateMyProfile)이 서명해서 한다 — 클라이언트는 삭제만
function clearCookie() {
  if (typeof document === "undefined") return;
  document.cookie = `${SESSION_COOKIE}=; path=/; max-age=0; samesite=lax`;
}

export function AuthProvider({
  initialUser = null,
  children,
}: {
  initialUser?: SessionUser | null;
  children: React.ReactNode;
}) {
  const router = useRouter();
  const [user, setUser] = useState<SessionUser | null>(initialUser);

  const login = useCallback(
    (u: SessionUser) => {
      setUser(u);
      // 서버 컴포넌트(인사말·장부 등)를 새 세션으로 다시 렌더
      router.refresh();
    },
    [router],
  );

  const logout = useCallback(() => {
    clearCookie();
    setUser(null);
    router.refresh();
  }, [router]);

  return <AuthContext.Provider value={{ user, login, logout }}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within <AuthProvider>");
  return ctx;
}
