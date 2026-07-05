"use client";

import { useEffect, useState } from "react";
import { subscribePush, unsubscribePush } from "@/lib/push-actions";
import {
  enablePush,
  getPushSubscription,
  pushConfigured,
  pushSupported,
  PUSH_CHANGED_EVENT,
} from "@/lib/push-client";

type State = "checking" | "unsupported" | "unconfigured" | "on" | "off" | "denied" | "busy";

export default function PushToggle() {
  const [state, setState] = useState<State>("checking");
  const [msg, setMsg] = useState("");

  useEffect(() => {
    const check = async () => {
      if (!pushConfigured()) return setState("unconfigured");
      if (!pushSupported()) return setState("unsupported");
      if (Notification.permission === "denied") return setState("denied");
      try {
        const sub = await getPushSubscription();
        setState(sub ? "on" : "off");
        // 기존 구독을 현재 로그인 회원과 다시 연결 (운영진 대상 발송 필터용, 실패 무시)
        if (sub) subscribePush(JSON.parse(JSON.stringify(sub))).catch(() => {});
      } catch {
        setState("off");
      }
    };
    void check();
    // 상단 배너 등 다른 곳에서 구독 상태가 바뀌면 즉시 다시 확인
    window.addEventListener(PUSH_CHANGED_EVENT, check);
    return () => window.removeEventListener(PUSH_CHANGED_EVENT, check);
  }, []);

  const enable = async () => {
    setMsg("");
    setState("busy");
    const res = await enablePush();
    if (res.status === "on") setState("on");
    else if (res.status === "denied") setState("denied");
    else {
      setMsg(res.msg ?? "");
      setState("off");
    }
  };

  const disable = async () => {
    setMsg("");
    setState("busy");
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (sub) {
        await unsubscribePush(sub.endpoint);
        await sub.unsubscribe();
      }
      setState("off");
    } catch {
      setState("on");
    }
  };

  return (
    <div className="card">
      <div className="title-row">
        <div className="grow">
          <span className="m-name">공지 푸시 알림</span>
          <div className="item-sub">새 공지사항이 올라오면 알림을 받습니다.</div>
        </div>
        {state === "on" && (
          <button className="btn ghost btn-sm" onClick={disable}>끄기</button>
        )}
        {state === "off" && (
          <button className="btn amber btn-sm" onClick={enable}>켜기</button>
        )}
        {state === "busy" && <button className="btn ghost btn-sm" disabled>처리 중…</button>}
      </div>
      {state === "on" && <p className="dim" style={{ fontSize: 12, margin: "8px 0 0" }}>알림이 켜져 있습니다.</p>}
      {state === "denied" && (
        <p className="dim" style={{ fontSize: 12, margin: "8px 0 0" }}>
          브라우저에서 알림이 차단돼 있습니다. 사이트 설정에서 알림을 허용해 주세요.
        </p>
      )}
      {state === "unsupported" && (
        <p className="dim" style={{ fontSize: 12, margin: "8px 0 0" }}>
          이 브라우저는 푸시 알림을 지원하지 않습니다. (홈 화면에 추가한 앱에서 사용하세요)
        </p>
      )}
      {state === "unconfigured" && (
        <p className="dim" style={{ fontSize: 12, margin: "8px 0 0" }}>
          푸시 알림이 아직 설정되지 않았습니다. (관리자 설정 필요)
        </p>
      )}
      {msg && <p className="form-error" style={{ marginBottom: 0 }}>{msg}</p>}
    </div>
  );
}
