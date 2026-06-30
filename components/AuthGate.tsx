"use client";

import { useAuth } from "@/lib/auth";
import LoginScreen from "./LoginScreen";

/** 로그인 전에는 로그인/회원가입 화면, 로그인 후에는 앱 본문을 보여준다. */
export default function AuthGate({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  if (!user) return <LoginScreen />;
  return <>{children}</>;
}
