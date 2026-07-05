"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";

/**
 * 우하단에 떠 있는 수동 새로고침 버튼 (스크롤해도 따라다님).
 * 페이지 이동 없이 현재 화면의 서버 데이터를 즉시 다시 불러온다.
 * 갱신 중에는 아이콘이 회전하며, useSyncedState 덕에 내용이 같으면 깜빡이지 않는다.
 */
export default function RefreshButton() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

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
        <polyline points="23 4 23 10 17 10" />
        <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
      </svg>
    </button>
  );
}
