"use client";

import { useEffect, useState } from "react";

/**
 * 토스트 알림 — 화면 아래에서 잠깐 올라왔다 사라지는 짧은 안내 (모임 앱처럼).
 * 어디서나 `toast("저장했습니다", "ok")` · `toast(오류문구, "error")`. app/layout.tsx 에 <Toaster /> 1회 마운트.
 * 계속 보여야 하는 경고(예약의 '일부만 저장됨' 등)는 토스트가 아니라 화면 안 문구로 둔다.
 */
type Kind = "info" | "ok" | "error";
type Item = { id: number; msg: string; kind: Kind; leaving: boolean };

let push: ((msg: string, kind: Kind) => void) | null = null;
let seq = 0;

export function toast(msg: string, kind: Kind = "info") {
  push?.(msg, kind);
}

const SHOW_MS = { info: 2600, ok: 2600, error: 4000 } as const;
const LEAVE_MS = 200;

export default function Toaster() {
  const [items, setItems] = useState<Item[]>([]);

  useEffect(() => {
    push = (msg, kind) => {
      const id = ++seq;
      setItems((prev) => [...prev.slice(-2), { id, msg, kind, leaving: false }]); // 최대 3개
      setTimeout(() => setItems((prev) => prev.map((t) => (t.id === id ? { ...t, leaving: true } : t))), SHOW_MS[kind]);
      setTimeout(() => setItems((prev) => prev.filter((t) => t.id !== id)), SHOW_MS[kind] + LEAVE_MS);
    };
    return () => {
      push = null;
    };
  }, []);

  return (
    <div className="toaster" role="status" aria-live="polite">
      {items.map((t) => (
        <div key={t.id} className={`toast ${t.kind}${t.leaving ? " leaving" : ""}`}>
          {t.msg}
        </div>
      ))}
    </div>
  );
}
