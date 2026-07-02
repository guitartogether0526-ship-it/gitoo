"use server";

import { can } from "./roles";
import { getSession } from "./session";
import { getSupabaseAdmin } from "./supabase-admin";
import { getAllMembers } from "./member-store";

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

  // 권한 확인: 운영진이거나 본인 팀 곡
  if (!can.manageTeams(session.role)) {
    const { data: song } = await sb.from("songs").select("team_id").eq("id", songId).single();
    const members = await getAllMembers();
    const me = members.find((m) => m.id === session.id);
    const myTeams = me ? [me.team_id, me.team_id_2].filter(Boolean) : [];
    if (!song || !me || !myTeams.includes((song as { team_id: string }).team_id)) {
      return { error: "본인 팀 곡만 변경할 수 있습니다." };
    }
  }

  const { error } = await sb.from("songs").update({ status }).eq("id", songId);
  if (error) return { error: "저장 실패: " + error.message };
  return { ok: true };
}
