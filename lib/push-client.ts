import { subscribePush } from "./push-actions";

/**
 * 푸시 구독 클라이언트 헬퍼 — PushToggle(마이페이지)과 PushBanner(상단 안내)가 공유.
 * 브라우저 API(Notification·serviceWorker)를 쓰므로 클라이언트 컴포넌트에서만 호출할 것.
 */

const PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;

/** 구독 상태 변경 알림 이벤트 — 배너에서 켜면 마이페이지 토글이 즉시 반영되도록 */
export const PUSH_CHANGED_EVENT = "gt-push-changed";

export function pushConfigured(): boolean {
  return !!PUBLIC_KEY;
}

export function pushSupported(): boolean {
  return (
    typeof window !== "undefined" && "serviceWorker" in navigator && "PushManager" in window
  );
}

function urlBase64ToUint8Array(base64: string): Uint8Array {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const b64 = (base64 + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(b64);
  const arr = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i);
  return arr;
}

/** 현재 브라우저의 푸시 구독 (없으면 null) */
export async function getPushSubscription(): Promise<PushSubscription | null> {
  const reg = await navigator.serviceWorker.ready;
  return reg.pushManager.getSubscription();
}

/** 알림 권한 요청 → 브라우저 구독 → 서버 저장(회원 연결)까지 한 번에. */
export async function enablePush(): Promise<{ status: "on" | "denied" | "error"; msg?: string }> {
  try {
    const perm = await Notification.requestPermission();
    if (perm !== "granted") return { status: perm === "denied" ? "denied" : "error" };
    const reg = await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(PUBLIC_KEY as string) as unknown as BufferSource,
    });
    const res = await subscribePush(JSON.parse(JSON.stringify(sub)));
    if ("error" in res) return { status: "error", msg: res.error };
    // 다른 곳(마이페이지 토글 등)에 상태 변경을 알림
    window.dispatchEvent(new Event(PUSH_CHANGED_EVENT));
    return { status: "on" };
  } catch {
    return { status: "error", msg: "알림 설정 중 오류가 발생했습니다." };
  }
}
