import type { Metadata, Viewport } from "next";
import "./globals.css";
import AppHeader from "@/components/AppHeader";
import BottomNav from "@/components/BottomNav";
import InstallBanner from "@/components/InstallBanner";
import ServiceWorkerRegister from "@/components/ServiceWorkerRegister";

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

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ko">
      <body>
        <div className="app-shell">
          <AppHeader />
          <main className="app-main">{children}</main>
          <InstallBanner />
          <BottomNav />
        </div>
        <ServiceWorkerRegister />
      </body>
    </html>
  );
}
