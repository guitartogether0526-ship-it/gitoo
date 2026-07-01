import type { Metadata, Viewport } from "next";
import { Inter, Noto_Sans_KR } from "next/font/google";
import "./globals.css";
import AppHeader from "@/components/AppHeader";
import BottomNav from "@/components/BottomNav";
import ServiceWorkerRegister from "@/components/ServiceWorkerRegister";
import LiveRefresh from "@/components/LiveRefresh";
import { AuthProvider } from "@/lib/auth";
import AuthGate from "@/components/AuthGate";
import { getSession } from "@/lib/session";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

const notoSansKr = Noto_Sans_KR({
  subsets: ["latin"],
  weight: ["400", "500", "700", "800"],
  variable: "--font-noto-kr",
  display: "swap",
});

export const metadata: Metadata = {
  title: "GUITAR TOGETHER",
  description: "기타 밴드 동호회 전용 PWA — 공지 · 예약 · 합주곡 · 회원 · 회비",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "기타투게더",
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
    <html lang="ko" className={`${inter.variable} ${notoSansKr.variable}`}>
      <body>
        <AuthProvider initialUser={session}>
          <AuthGate>
            <div className="app-shell">
              <AppHeader />
              <main className="app-main">{children}</main>
              <BottomNav />
            </div>
            <LiveRefresh />
          </AuthGate>
        </AuthProvider>
        <ServiceWorkerRegister />
      </body>
    </html>
  );
}
