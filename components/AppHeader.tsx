"use client";

import { usePathname } from "next/navigation";
import Logo from "./Logo";

const TITLES: Record<string, { page: string; sub: string }> = {
  "/": { page: "대시보드", sub: "오늘의 동호회 소식" },
  "/reservation": { page: "연습실 예약", sub: "캘린더 예약 (1실)" },
  "/board": { page: "게시판", sub: "공지사항 · 자유게시판" },
  "/setlist": { page: "합주곡 · 악보", sub: "팀별 셋리스트 & 투표" },
  "/members": { page: "회원 / 관리자", sub: "운영진 전용 대시보드" },
  "/finance": { page: "회비 · 총무 장부", sub: "납부 현황 & 지출" },
};

export default function AppHeader() {
  const pathname = usePathname();
  const t = TITLES[pathname] ?? TITLES["/"];

  return (
    <header className="app-header">
      <Logo />
      <div className="header-title">
        <span className="ht-page">{t.page}</span>
        <span className="ht-sub">{t.sub}</span>
      </div>
    </header>
  );
}
