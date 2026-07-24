"use server";

import { getSession } from "./session";
import { getSupabaseAdmin } from "./supabase-admin";
import { getAllMembers } from "./member-store";
import { getTeams } from "./db";
import { kstYmd } from "./date";

/** 내 '안되는 날' 추가/해제 */
export async function setUnavailable(
  date: string,
  unavailable: boolean,
): Promise<{ ok: true } | { error: string }> {
  const session = await getSession();
  if (!session || session.id === "admin") return { error: "회원만 사용할 수 있습니다." };
  const sb = getSupabaseAdmin();
  if (!sb) return { error: "DB가 설정되지 않았습니다. (Supabase 환경변수 확인)" };

  if (unavailable) {
    const { error } = await sb
      .from("unavailable_dates")
      .upsert({ member_id: session.id, date }, { onConflict: "member_id,date" });
    if (error) return { error: "저장 실패: " + error.message };
  } else {
    const { error } = await sb
      .from("unavailable_dates")
      .delete()
      .eq("member_id", session.id)
      .eq("date", date);
    if (error) return { error: "저장 실패: " + error.message };
  }
  return { ok: true };
}

/** 내가 표시한 '안되는 날' 목록(YYYY-MM-DD) */
export async function getMyUnavailable(): Promise<string[]> {
  const session = await getSession();
  if (!session) return [];
  const sb = getSupabaseAdmin();
  if (!sb) return [];
  const { data } = await sb.from("unavailable_dates").select("date").eq("member_id", session.id);
  return (data ?? []).map((r) => r.date as string);
}

/** 본인 팀의 '안되는 날' 현황 — 팀별로 나눠 날짜별 안되는 사람 목록. 본인 팀만 조회. */
export async function getTeamUnavailable(): Promise<
  | { teams: { teamId: string; teamName: string; days: { date: string; names: string[] }[] }[] }
  | { error: string }
> {
  const session = await getSession();
  if (!session) return { error: "로그인이 필요합니다." };

  const members = await getAllMembers();
  const me = members.find((m) => m.id === session.id);
  // 본인 소속 팀(최대 2개) — 두 팀에 속하면 팀별 섹션으로 각각 조회
  const myTeams = [
    me?.team_id ?? session.team_id ?? null,
    me?.team_id_2 ?? session.team_id_2 ?? null,
  ].filter((v): v is string => !!v);
  if (myTeams.length === 0)
    return { error: "팀이 배정되어야 일정을 볼 수 있습니다. 운영진에게 문의하세요." };

  const sb = getSupabaseAdmin();
  if (!sb) return { error: "DB가 설정되지 않았습니다. (Supabase 환경변수 확인)" };

  const teamMembers = members.filter(
    (m) => (m.team_id && myTeams.includes(m.team_id)) || (m.team_id_2 && myTeams.includes(m.team_id_2)),
  );
  const nameById = new Map(teamMembers.map((m) => [m.id, m.name]));
  const teamNameById = new Map((await getTeams()).map((t) => [t.id, t.name]));

  // 오늘 이후만 (한국시간 기준) — 두 팀이면 인원이 겹칠 수 있어 한 번에 조회 후 팀별로 나눈다
  const todayStr = kstYmd();
  const ids = teamMembers.map((m) => m.id);
  const { data, error } = ids.length
    ? await sb
        .from("unavailable_dates")
        .select("member_id,date")
        .in("member_id", ids)
        .gte("date", todayStr)
    : { data: [], error: null };
  // 오류를 삼키면 전부 "모두 가능"(녹색)으로 잘못 표시된다
  if (error) return { error: "일정을 불러오지 못했습니다: " + error.message };

  const teams = myTeams.map((teamId) => {
    const inTeam = new Set(
      teamMembers.filter((m) => m.team_id === teamId || m.team_id_2 === teamId).map((m) => m.id),
    );
    const byDate = new Map<string, string[]>();
    for (const r of data ?? []) {
      if (!inTeam.has(r.member_id as string)) continue;
      const name = nameById.get(r.member_id as string);
      if (!name) continue;
      const arr = byDate.get(r.date as string) ?? [];
      arr.push(name);
      byDate.set(r.date as string, arr);
    }
    const days = [...byDate.entries()]
      .map(([date, names]) => ({ date, names: names.sort((a, b) => a.localeCompare(b, "ko")) }))
      .sort((a, b) => a.date.localeCompare(b.date));
    return { teamId, teamName: teamNameById.get(teamId) ?? "내 팀", days };
  });

  return { teams };
}
