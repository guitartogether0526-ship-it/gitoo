"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/**
 * 라이브 갱신 — 새로고침 없이 최신 데이터가 화면에 반영되도록 한다.
 *
 * 다른 사람이 올린 글·가입 신청·예약 등은 내 화면이 이미 떠 있으면 자동으로
 * 보이지 않는다(서버 컴포넌트가 최초 1회만 읽어오므로). 이를 보완하기 위해:
 *   - 탭이 다시 활성화되거나(focus / visibilitychange) 앱으로 돌아올 때 즉시,
 *   - 화면을 보고 있는 동안 일정 주기로,
 * 서버 데이터를 다시 불러온다(router.refresh).
 *
 * 각 목록 컴포넌트는 서버 props가 바뀌면 로컬 상태를 다시 맞추므로(useEffect),
 * router.refresh 결과가 실제 화면에 그대로 반영된다.
 */
export default function LiveRefresh({ intervalMs = 15000 }: { intervalMs?: number }) {
  const router = useRouter();

  useEffect(() => {
    const refresh = () => {
      if (document.visibilityState === "visible") router.refresh();
    };
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", refresh);
    const id = window.setInterval(refresh, intervalMs);
    return () => {
      window.removeEventListener("focus", refresh);
      document.removeEventListener("visibilitychange", refresh);
      window.clearInterval(id);
    };
  }, [router, intervalMs]);

  return null;
}
