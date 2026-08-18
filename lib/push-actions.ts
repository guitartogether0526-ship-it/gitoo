"use server";

import { can } from "./roles";
import { getSession } from "./session";
import { getSupabaseAdmin } from "./supabase-admin";
import { getAllMembers } from "./member-store";
import { koDateLabel } from "./date";
import {
  isPushConfigured,
  saveSubscription,
  removeSubscription,
  sendToAll,
  sendToTeam,
  sendToMembers,
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

/**
 * 합주곡 업로드 시 호출 — 해당 팀 소속 회원에게만 푸시 발송 (올린 본인은 제외).
 * 권한: 운영진(모든 팀) 또는 본인 팀 — setSongStatus 와 동일한 기준.
 */
export async function sendSongPush(
  teamId: string,
  songTitle: string,
  artist: string,
): Promise<{ ok: true; sent: number } | { error: string }> {
  const session = await getSession();
  if (!session) return { error: "로그인이 필요합니다." };

  if (!can.manageTeams(session.role)) {
    const members = await getAllMembers();
    const me = members.find((m) => m.id === session.id);
    const myTeams = me ? [me.team_id, me.team_id_2, me.team_id_3].filter(Boolean) : [];
    if (!myTeams.includes(teamId)) return { error: "본인 팀 곡만 알림을 보낼 수 있습니다." };
  }

  // 팀 이름 확인 (존재하지 않는 팀이면 발송하지 않음)
  const sb = getSupabaseAdmin();
  if (!sb) return { error: "DB가 설정되지 않았습니다." };
  const { data: team } = await sb.from("teams").select("name").eq("id", teamId).single();
  if (!team) return { error: "팀을 찾을 수 없습니다." };

  const body = artist ? `${songTitle} · ${artist}` : songTitle;
  const { sent } = await sendToTeam(
    teamId,
    { title: `🎸 ${team.name} 새 합주곡`, body, url: "/setlist" },
    session.id,
  );
  return { ok: true, sent };
}

/**
 * 연습실 예약 등록 시 호출.
 *  - 합주(예약자 = 팀 이름): 그 팀 소속 회원에게 "합주 일정이 등록됐습니다" (등록한 본인 제외)
 *  - 개인연습: 등록한 본인에게만 예약 확인 알림
 *  - 그 외 용도(MT·정기공연 등): 발송 없음
 */
export async function sendReservationPush(
  purpose: string,
  reservedBy: string,
  date: string, // "YYYY-MM-DD"
  timeLabel: string,
): Promise<{ ok: true; sent: number } | { error: string }> {
  const session = await getSession();
  if (!session) return { error: "로그인이 필요합니다." };

  if (purpose === "개인연습") {
    const { sent } = await sendToMembers([session.id], {
      title: "🎸 개인연습 예약이 등록됐습니다",
      body: `${koDateLabel(date)} ${timeLabel} 연습실`,
      url: "/reservation",
    });
    return { ok: true, sent };
  }

  if (purpose !== "합주") return { ok: true, sent: 0 };

  const sb = getSupabaseAdmin();
  if (!sb) return { error: "DB가 설정되지 않았습니다." };

  // 합주는 예약자가 팀 이름일 때만 팀에게 발송 (개인 이름 합주는 발송 없음)
  const { data: team } = await sb
    .from("teams")
    .select("id,name")
    .eq("name", reservedBy)
    .maybeSingle();
  if (!team) return { ok: true, sent: 0 };

  // 권한: 운영진이거나 본인 팀 (합주곡 알림과 동일 기준)
  if (!can.manageTeams(session.role)) {
    const members = await getAllMembers();
    const me = members.find((m) => m.id === session.id);
    const myTeams = me ? [me.team_id, me.team_id_2, me.team_id_3].filter(Boolean) : [];
    if (!myTeams.includes(team.id)) return { error: "본인 팀 예약만 알림을 보낼 수 있습니다." };
  }

  const { sent } = await sendToTeam(
    team.id,
    {
      title: "🎸 합주 일정이 등록됐습니다",
      body: `${team.name} · ${koDateLabel(date)} ${timeLabel}`,
      url: "/reservation",
    },
    session.id,
  );
  return { ok: true, sent };
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
