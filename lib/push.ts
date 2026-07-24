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

export async function saveSubscription(sub: PushSub, memberId?: string | null): Promise<void> {
  const sb = getSupabaseAdmin();
  if (!sb || !sub?.endpoint) return;
  await sb
    .from("push_subscriptions")
    .upsert(
      {
        endpoint: sub.endpoint,
        p256dh: sub.keys.p256dh,
        auth: sub.keys.auth,
        member_id: memberId ?? null,
      },
      { onConflict: "endpoint" },
    );
}

export async function removeSubscription(endpoint: string): Promise<void> {
  const sb = getSupabaseAdmin();
  if (sb && endpoint) await sb.from("push_subscriptions").delete().eq("endpoint", endpoint);
}

type PushPayload = { title: string; body: string; url?: string };
type SubRow = { endpoint: string; p256dh: string; auth: string };

/** 구독 목록에 발송. 만료(404/410) 구독은 자동 정리. */
async function sendToSubs(
  sb: NonNullable<ReturnType<typeof getSupabaseAdmin>>,
  subs: SubRow[],
  payload: PushPayload,
): Promise<{ sent: number }> {
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

/** 저장된 모든 구독에게 발송. */
export async function sendToAll(payload: PushPayload): Promise<{ sent: number }> {
  if (!ensureVapid()) return { sent: 0 };
  const sb = getSupabaseAdmin();
  if (!sb) return { sent: 0 };

  const { data } = await sb.from("push_subscriptions").select("endpoint,p256dh,auth");
  return sendToSubs(sb, data ?? [], payload);
}

/** 특정 회원 id 목록의 구독에게 발송. */
export async function sendToMembers(
  memberIds: string[],
  payload: PushPayload,
): Promise<{ sent: number }> {
  if (!ensureVapid()) return { sent: 0 };
  const sb = getSupabaseAdmin();
  if (!sb || memberIds.length === 0) return { sent: 0 };

  const { data } = await sb
    .from("push_subscriptions")
    .select("endpoint,p256dh,auth")
    .in("member_id", memberIds);
  return sendToSubs(sb, data ?? [], payload);
}

/**
 * 특정 팀 소속 회원(팀1 또는 팀2) 구독에게만 발송.
 * excludeMemberId 는 행위자 본인 제외용(본인이 올린 곡 알림은 본인에게 안 감).
 */
export async function sendToTeam(
  teamId: string,
  payload: PushPayload,
  excludeMemberId?: string,
): Promise<{ sent: number }> {
  if (!ensureVapid()) return { sent: 0 };
  const sb = getSupabaseAdmin();
  if (!sb) return { sent: 0 };

  // 팀1·팀2 소속을 각각 조회해 합침 (한 사람이 두 팀 참여 가능)
  const [t1, t2] = await Promise.all([
    sb.from("members").select("id").eq("team_id", teamId),
    sb.from("members").select("id").eq("team_id_2", teamId),
  ]);
  const ids = [...new Set([...(t1.data ?? []), ...(t2.data ?? [])].map((m) => m.id))].filter(
    (id) => id !== excludeMemberId,
  );
  return sendToMembers(ids, payload);
}

/**
 * 운영진(STAFF 이상: admin·회장·총무·STAFF) 구독에게만 발송.
 * member_id 가 연결된 구독만 대상 — 구독을 다시 켜기 전의 옛 구독(연결 없음)은 제외.
 */
export async function sendToStaff(payload: PushPayload): Promise<{ sent: number }> {
  if (!ensureVapid()) return { sent: 0 };
  const sb = getSupabaseAdmin();
  if (!sb) return { sent: 0 };

  const { data: staff } = await sb
    .from("members")
    .select("id")
    .in("role", ["president", "treasurer", "staff"]);
  // 관리자(admin) 특수 계정은 members 테이블에 없으므로 id 를 직접 포함
  const ids = [...(staff ?? []).map((m) => m.id), "admin"];

  const { data } = await sb
    .from("push_subscriptions")
    .select("endpoint,p256dh,auth")
    .in("member_id", ids);
  return sendToSubs(sb, data ?? [], payload);
}
