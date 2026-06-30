import "server-only";
import webpush from "web-push";
import { getSupabaseAdmin } from "./supabase-admin";

/**
 * 웹푸시(Web Push) 발송 — 서버 전용.
 *
 * 필요한 환경변수:
 *   - NEXT_PUBLIC_VAPID_PUBLIC_KEY  : 공개키(클라이언트 구독에도 사용)
 *   - VAPID_PRIVATE_KEY             : 비공개키(서버 발송 전용, 절대 노출 금지)
 *   - VAPID_SUBJECT                 : mailto:연락처 (선택, 미설정 시 기본값)
 *
 * 구독 정보는 push_subscriptions 테이블에 저장(서비스롤로만 접근).
 */

const PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
const PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY;
const SUBJECT = process.env.VAPID_SUBJECT ?? "mailto:admin@guitartogether.app";

export function isPushConfigured(): boolean {
  return !!PUBLIC_KEY && !!PRIVATE_KEY;
}

let vapidSet = false;
function ensureVapid(): boolean {
  if (!isPushConfigured()) return false;
  if (!vapidSet) {
    webpush.setVapidDetails(SUBJECT, PUBLIC_KEY as string, PRIVATE_KEY as string);
    vapidSet = true;
  }
  return true;
}

export type PushSub = {
  endpoint: string;
  keys: { p256dh: string; auth: string };
};

export async function saveSubscription(sub: PushSub): Promise<void> {
  const sb = getSupabaseAdmin();
  if (!sb || !sub?.endpoint) return;
  await sb
    .from("push_subscriptions")
    .upsert(
      { endpoint: sub.endpoint, p256dh: sub.keys.p256dh, auth: sub.keys.auth },
      { onConflict: "endpoint" },
    );
}

export async function removeSubscription(endpoint: string): Promise<void> {
  const sb = getSupabaseAdmin();
  if (sb && endpoint) await sb.from("push_subscriptions").delete().eq("endpoint", endpoint);
}

/** 저장된 모든 구독에게 발송. 만료(404/410) 구독은 자동 정리. */
export async function sendToAll(payload: {
  title: string;
  body: string;
  url?: string;
}): Promise<{ sent: number }> {
  if (!ensureVapid()) return { sent: 0 };
  const sb = getSupabaseAdmin();
  if (!sb) return { sent: 0 };

  const { data } = await sb.from("push_subscriptions").select("endpoint,p256dh,auth");
  const subs = data ?? [];
  const json = JSON.stringify(payload);
  let sent = 0;

  await Promise.all(
    subs.map(async (s) => {
      try {
        await webpush.sendNotification(
          { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
          json,
        );
        sent += 1;
      } catch (e: unknown) {
        const code = (e as { statusCode?: number })?.statusCode;
        if (code === 404 || code === 410) {
          await sb.from("push_subscriptions").delete().eq("endpoint", s.endpoint);
        }
      }
    }),
  );
  return { sent };
}
