"use client";

import { useEffect, useState } from "react";
import { enablePush, getPushSubscription, pushConfigured, pushSupported } from "@/lib/push-client";

// 켜기/안함 중 하나를 선택하면 저장 — 다시는 안 보임 (마이페이지에서 언제든 변경 가능)
const LS_KEY = "gt-push-banner";

/**
 * 푸시 알림 켜기 안내 상단바 — 헤더 바로 아래.
 * 아직 구독하지 않았고 선택한 적 없는 로그인 사용자에게만 노출.
 * (미지원 브라우저·권한 차단·VAPID 미설정 시에는 나오지 않음)
 */
export default function PushBanner() {
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        if (localStorage.getItem(LS_KEY)) return;
        if (!pushConfigured() || !pushSupported()) return;
        if (Notification.permission === "denied") return;
        if (await getPushSubscription()) return; // 이미 켜져 있음
        setShow(true);
      } catch {
        // 확인 실패 시 노출하지 않음
      }
    })();
  }, []);

  const choose = async (enable: boolean) => {
    if (enable) {
      setBusy(true);
      await enablePush(); // 실패해도 배너는 닫는다 — 마이페이지에서 다시 켤 수 있음
      setBusy(false);
    }
    try {
      localStorage.setItem(LS_KEY, "done");
    } catch {}
    setShow(false);
  };

  if (!show) return null;

  return (
    <div className="push-banner">
      <svg
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        style={{ flexShrink: 0, color: "var(--accent)" }}
      >
        <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
        <path d="M13.73 21a2 2 0 0 1-3.46 0" />
      </svg>
      <div className="grow" style={{ minWidth: 0 }}>
        공지·합주 일정 <b>푸시 알림</b>을 받아보세요
      </div>
      <button className="btn amber btn-sm" disabled={busy} onClick={() => choose(true)}>
        {busy ? "설정 중…" : "켜기"}
      </button>
      <button className="btn ghost btn-sm" disabled={busy} onClick={() => choose(false)}>
        안함
      </button>
    </div>
  );
}
