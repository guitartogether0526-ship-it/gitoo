"use server";

import { can } from "./roles";
import { getSession } from "./session";
import {
  isPushConfigured,
  saveSubscription,
  removeSubscription,
  sendToAll,
  type PushSub,
} from "./push";

/** 푸시 구독 저장 (로그인 사용자) — 구독을 회원 id 와 연결(운영진 대상 발송 필터용) */
export async function subscribePush(sub: PushSub): Promise<{ ok: true } | { error: string }> {
  const session = await getSession();
  if (!session) return { error: "로그인이 필요합니다." };
  if (!isPushConfigured()) return { error: "푸시 알림이 서버에 설정되지 않았습니다." };
  await saveSubscription(sub, session.id);
  return { ok: true };
}

/** 푸시 구독 해제 */
export async function unsubscribePush(endpoint: string): Promise<{ ok: true }> {
  await removeSubscription(endpoint);
  return { ok: true };
}

/** 공지 작성 시 호출 — 구독자 전체에게 푸시 발송 (공지 작성 권한자만) */
export async function sendNoticePush(
  title: string,
  body: string,
): Promise<{ ok: true; sent: number } | { error: string }> {
  const session = await getSession();
  if (!can.writeNotice(session?.role)) return { error: "권한이 없습니다." };
  const preview = body.trim().slice(0, 120);
  const { sent } = await sendToAll({ title: `📢 ${title}`, body: preview, url: "/board" });
  return { ok: true, sent };
}
