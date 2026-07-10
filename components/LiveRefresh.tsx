"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { hasRefreshHold } from "@/lib/refresh-hold";

/**
 * 라이브 갱신 — 필요한 순간에만 서버 데이터를 다시 불러온다(router.refresh).
 *
 * 정책 (예전의 주기 갱신 — 전 페이지 20초, 회비 60초 — 은 잦은 재렌더가 불편해 폐지.
 * 화면을 띄워둔 채 갱신하려면 우하단 수동 새로고침 버튼 사용):
 *   1. 페이지 이동: Next.js 15는 동적 페이지를 클라이언트 라우터 캐시에 재사용하지
 *      않으므로(staleTimes.dynamic = 0) 이동할 때마다 자동으로 최신 데이터를 받는다
 *      — 별도 코드 불필요.
 *   2. 앱 복귀(백그라운드 → 보임): 모든 페이지에서 1회 갱신.
 *
 * ⚠️ iOS Safari는 링크를 탭할 때도 window 'focus'가 발생해 focus는 쓰지 않고,
 *    실제 앱 복귀 신호인 'visibilitychange'(숨김→보임)만 사용하며, 연속 refresh는
 *    최소 간격(MIN_GAP)으로 디바운스한다.
 *
 * ⚠️ 편집/작성 중에는 보류 — 입력창(input·textarea·select·contentEditable)에
 *    포커스가 있거나, 폼/팝업이 열려 있으면(lib/refresh-hold) 건너뛴다.
 *    iOS에서 재렌더되면 키보드가 닫히고 한글 조합이 끊기기 때문.
 *
 * 각 목록 컴포넌트는 서버 props가 바뀌면 로컬 상태를 다시 맞추므로(useSyncedState —
 * 내용이 같으면 리렌더 없음), router.refresh 결과가 실제 화면에 그대로 반영된다.
 */
const MIN_GAP = 5000; // 연속 refresh(깜빡임) 방지 최소 간격

export default function LiveRefresh() {
  const router = useRouter();
  const lastRef = useRef(0);

  useEffect(() => {
    const refresh = () => {
      if (document.visibilityState !== "visible") return;
      // 작성·수정 폼/팝업이 열려 있으면 보류 — 닫히면 다음 기회에 갱신된다.
      if (hasRefreshHold()) return;
      const el = document.activeElement;
      if (
        el instanceof HTMLElement &&
        (el.tagName === "INPUT" ||
          el.tagName === "TEXTAREA" ||
          el.tagName === "SELECT" ||
          el.isContentEditable)
      ) {
        return;
      }
      const now = Date.now();
      if (now - lastRef.current < MIN_GAP) return;
      lastRef.current = now;
      router.refresh();
    };

    // 백그라운드 → 포그라운드로 앱에 다시 돌아왔을 때 갱신 (전 페이지 공통)
    document.addEventListener("visibilitychange", refresh);
    return () => {
      document.removeEventListener("visibilitychange", refresh);
    };
  }, [router]);

  return null;
}
