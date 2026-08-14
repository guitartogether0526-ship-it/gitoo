"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

/**
 * 우하단에 떠 있는 수동 새로고침 버튼 (스크롤해도 따라다님).
 * 페이지 이동 없이 현재 화면의 서버 데이터를 즉시 다시 불러온다.
 * 갱신 중에는 아이콘이 회전하며, useSyncedState 덕에 내용이 같으면 깜빡이지 않는다.
 *
 * ⚠️ 내용이 같으면 화면이 하나도 안 바뀌어 "눌러도 반응이 없다"고 느껴진다 —
 *    끝나면 체크 아이콘(1.2초)과 짧은 진동으로 완료를 알린다.
 */
export default function RefreshButton() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [done, setDone] = useState(false);
  const wasPending = useRef(false);

  useEffect(() => {
    if (isPending) {
      wasPending.current = true;
      return;
    }
    if (!wasPending.current) return; // 최초 렌더 — 갱신한 적 없음
    wasPending.current = false;
    navigator.vibrate?.(15); // 지원 안 하는 브라우저(iOS)는 무시
    setDone(true);
    const t = setTimeout(() => setDone(false), 1200);
    return () => clearTimeout(t);
  }, [isPending]);

  return (
    <button
      type="button"
      className="fab-refresh"
      aria-label="새로고침"
      title="새로고침"
      disabled={isPending}
      onClick={() => startTransition(() => router.refresh())}
    >
      <svg
        width="20"
        height="20"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className={isPending ? "spin" : undefined}
      >
        {done && !isPending ? (
          <polyline points="4 12.5 9.5 18 20 6.5" />
        ) : (
          <>
            <polyline points="23 4 23 10 17 10" />
            <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
          </>
        )}
      </svg>
    </button>
  );
}
