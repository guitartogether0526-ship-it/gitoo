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

function writeCookie(user: SessionUser | null) {
  if (typeof document === "undefined") return;
  if (user) {
    const value = encodeURIComponent(JSON.stringify(user));
    // 30일 유지
    document.cookie = `${SESSION_COOKIE}=${value}; path=/; max-age=${60 * 60 * 24 * 30}; samesite=lax`;
  } else {
    document.cookie = `${SESSION_COOKIE}=; path=/; max-age=0; samesite=lax`;
  }
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
      writeCookie(u);
      setUser(u);
      // 서버 컴포넌트(인사말·장부 등)를 새 세션으로 다시 렌더
      router.refresh();
    },
    [router],
  );

  const logout = useCallback(() => {
    writeCookie(null);
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
