"use client";

import { useEffect, useState } from "react";
import { subscribePush, unsubscribePush } from "@/lib/push-actions";

const PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;

function urlBase64ToUint8Array(base64: string): Uint8Array {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const b64 = (base64 + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(b64);
  const arr = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i);
  return arr;
}

type State = "checking" | "unsupported" | "unconfigured" | "on" | "off" | "denied" | "busy";

export default function PushToggle() {
  const [state, setState] = useState<State>("checking");
  const [msg, setMsg] = useState("");

  useEffect(() => {
    (async () => {
      if (!PUBLIC_KEY) return setState("unconfigured");
      if (typeof window === "undefined" || !("serviceWorker" in navigator) || !("PushManager" in window)) {
        return setState("unsupported");
      }
      if (Notification.permission === "denied") return setState("denied");
      try {
        const reg = await navigator.serviceWorker.ready;
        const sub = await reg.pushManager.getSubscription();
        setState(sub ? "on" : "off");
      } catch {
        setState("off");
      }
    })();
  }, []);

  const enable = async () => {
    setMsg("");
    setState("busy");
    try {
      const perm = await Notification.requestPermission();
      if (perm !== "granted") {
        setState(perm === "denied" ? "denied" : "off");
        return;
      }
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(PUBLIC_KEY as string) as unknown as BufferSource,
      });
      const res = await subscribePush(JSON.parse(JSON.stringify(sub)));
      if ("error" in res) {
        setMsg(res.error);
        setState("off");
        return;
      }
      setState("on");
    } catch (e) {
      setMsg("알림 설정 중 오류가 발생했습니다.");
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
