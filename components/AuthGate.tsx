"use client";

import { usePathname } from "next/navigation";
import { useAuth } from "@/lib/auth";
import LoginScreen from "./LoginScreen";

// 로그인 없이 볼 수 있는 경로 — QR로 공유하는 안내 페이지. 헤더·탭·푸시배너 없이 본문만 보여준다.
const PUBLIC_PATHS = new Set(["/sound-guide"]);

/** 로그인 전에는 로그인/회원가입 화면, 로그인 후에는 앱 본문을 보여준다. */
export default function AuthGate({ children, page }: { children: React.ReactNode; page: React.ReactNode }) {
  const { user } = useAuth();
  const pathname = usePathname();
  if (user) return <>{children}</>;
  if (PUBLIC_PATHS.has(pathname)) {
    return (
      <div className="app-shell">
        <main className="app-main">{page}</main>
      </div>
    );
  }
  return <LoginScreen />;
}
