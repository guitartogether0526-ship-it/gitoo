"use server";

import { can } from "./roles";
import { getSession } from "./session";
import { getSupabaseAdmin } from "./supabase-admin";
import { getAllMembers } from "./member-store";

/** 운영진이 아니면 본인 팀 곡만 허용 — 위반 시 오류 문구, 통과면 null */
async function teamPermError(
  sb: NonNullable<ReturnType<typeof getSupabaseAdmin>>,
  session: import("./types").SessionUser,
  songId: string,
  denied: string,
): Promise<string | null> {
  if (can.manageTeams(session.role)) return null;
  const { data: song } = await sb.from("songs").select("team_id").eq("id", songId).single();
  const me = (await getAllMembers()).find((m) => m.id === session.id);
  const myTeams = me ? [me.team_id, me.team_id_2].filter(Boolean) : [];
  if (!song || !me || !myTeams.includes((song as { team_id: string }).team_id)) return denied;
  return null;
}

/**
 * 곡 선정/후보 상태 저장 — 서버 액션(서비스롤).
 * 권한: 운영진(모든 팀) 또는 본인 팀 곡.
 * 클라이언트 anon 쓰기가 막혀도 동작하도록 서버에서 처리.
 */
export async function setSongStatus(
  songId: string,
  status: "confirmed" | "candidate",
): Promise<{ ok: true } | { error: string }> {
  const session = await getSession();
  if (!session) return { error: "로그인이 필요합니다." };

  const sb = getSupabaseAdmin();
  if (!sb) return { error: "DB가 설정되지 않았습니다. (Supabase 환경변수 확인)" };

  const denied = await teamPermError(sb, session, songId, "본인 팀 곡만 변경할 수 있습니다.");
  if (denied) return { error: denied };

  const { error } = await sb.from("songs").update({ status }).eq("id", songId);
  if (error) return { error: "저장 실패: " + error.message };
  return { ok: true };
}

/**
 * 합주곡 좋아요 토글 — 회원별 1인 1투표 (song_votes 테이블).
 * 권한: 운영진(모든 팀) 또는 본인 팀 곡 (setSongStatus와 동일 기준).
 * 반환값의 voted·likes는 서버 확정값 — 클라이언트가 그대로 반영한다.
 */
export async function toggleSongVote(
  songId: string,
): Promise<{ ok: true; voted: boolean; likes: number } | { error: string }> {
  const session = await getSession();
  if (!session) return { error: "로그인이 필요합니다." };

  const sb = getSupabaseAdmin();
  if (!sb) return { error: "DB가 설정되지 않았습니다. (Supabase 환경변수 확인)" };

  const denied = await teamPermError(sb, session, songId, "본인 팀 곡만 투표할 수 있습니다.");
  if (denied) return { error: denied };

  // 테이블 미생성: PostgREST는 PGRST205, PG 직접 오류는 42P01
  const friendly = (e: { code?: string; message: string }) =>
    e.code === "PGRST205" || e.code === "42P01"
      ? "DB에 song_votes 테이블이 없습니다. supabase/schema.sql을 다시 실행해 주세요."
      : "저장 실패: " + e.message;

  const { data: existing, error: selErr } = await sb
    .from("song_votes")
    .select("song_id")
    .eq("song_id", songId)
    .eq("member_id", session.id)
    .maybeSingle();
  if (selErr) return { error: friendly(selErr) };

  if (existing) {
    const { error } = await sb
      .from("song_votes")
      .delete()
      .eq("song_id", songId)
      .eq("member_id", session.id);
    if (error) return { error: friendly(error) };
  } else {
    const { error } = await sb
      .from("song_votes")
      .insert({ song_id: songId, member_id: session.id });
    if (error) return { error: friendly(error) };
  }

  const { count } = await sb
    .from("song_votes")
    .select("*", { count: "exact", head: true })
    .eq("song_id", songId);
  return { ok: true, voted: !existing, likes: count ?? 0 };
}
