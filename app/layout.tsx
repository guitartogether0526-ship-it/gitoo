import type { Metadata, Viewport } from "next";
import "./globals.css";
import AppHeader from "@/components/AppHeader";
import BottomNav from "@/components/BottomNav";
import InstallBanner from "@/components/InstallBanner";
import ServiceWorkerRegister from "@/components/ServiceWorkerRegister";
import { AuthProvider } from "@/lib/auth";
import AuthGate from "@/components/AuthGate";
import { getSession } from "@/lib/session";

export const metadata: Metadata = {
  title: "GUITAR TOGETHER",
  description: "기타 밴드 동호회 전용 PWA — 공지 · 예약 · 장비 · 셋리스트 · 회원 · 회비",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "GUITAR TOGETHER",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  themeColor: "#181311",
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSession();

  return (
    <html lang="ko">
      <body>
        <AuthProvider initialUser={session}>
          <AuthGate>
            <div className="app-shell">
              <AppHeader />
              <main className="app-main">{children}</main>
              <InstallBanner />
              <BottomNav />
            </div>
          </AuthGate>
        </AuthProvider>
        <ServiceWorkerRegister />
      </body>
    </html>
  );
}
