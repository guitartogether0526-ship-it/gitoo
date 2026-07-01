"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";

/**
 * 라이브 갱신 — 새로고침 없이 최신 데이터가 화면에 반영되도록 한다.
 *
 * 다른 사람이 올린 글·가입 신청·예약 등은 내 화면이 이미 떠 있으면 자동으로
 * 보이지 않는다(서버 컴포넌트가 최초 1회만 읽어오므로). 이를 보완하기 위해:
 *   - 앱으로 다시 돌아올 때(백그라운드→포그라운드) 즉시,
 *   - 화면을 보고 있는 동안 일정 주기로,
 * 서버 데이터를 다시 불러온다(router.refresh).
 *
 * ⚠️ iOS Safari는 링크를 탭할 때도 window 'focus'를 발생시켜, 화면 이동 직후
 *    불필요한 refresh가 겹치면 목록이 "나왔다 없어졌다" 깜빡인다. 그래서
 *    focus는 쓰지 않고, 실제 앱 복귀 신호인 'visibilitychange'(숨김→보임)만
 *    사용하고, 연속 refresh는 최소 간격으로 디바운스한다.
 *
 * 각 목록 컴포넌트는 서버 props가 바뀌면 로컬 상태를 다시 맞추므로(useEffect),
 * router.refresh 결과가 실제 화면에 그대로 반영된다.
 */
export default function LiveRefresh({ intervalMs = 20000 }: { intervalMs?: number }) {
  const router = useRouter();
  const lastRef = useRef(0);

  useEffect(() => {
    const MIN_GAP = 5000; // 연속 refresh(깜빡임) 방지 최소 간격
    const refresh = () => {
      if (document.visibilityState !== "visible") return;
      const now = Date.now();
      if (now - lastRef.current < MIN_GAP) return;
      lastRef.current = now;
      router.refresh();
    };
    // 백그라운드 → 포그라운드로 앱에 다시 돌아왔을 때만 갱신
    document.addEventListener("visibilitychange", refresh);
    const id = window.setInterval(refresh, intervalMs);
    return () => {
      document.removeEventListener("visibilitychange", refresh);
      window.clearInterval(id);
    };
  }, [router, intervalMs]);

  return null;
}
