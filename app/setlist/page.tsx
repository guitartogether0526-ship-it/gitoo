import { getSongs, getTeams, getMembers } from "@/lib/db";
import { getSession } from "@/lib/session";
import SetlistView from "@/components/SetlistView";

export const dynamic = "force-dynamic";

export default async function SetlistPage() {
  const [teams, songs, members, session] = await Promise.all([
    getTeams(),
    getSongs(),
    getMembers(),
    getSession(),
  ]);

  // 로그인한 회원의 팀 (본인팀 곡만 수정·삭제 가능; 운영진은 전체) — 최대 2개 팀
  const me = members.find((m) => m.id === session?.id);
  const myTeamIds = [
    me?.team_id ?? session?.team_id ?? null,
    me?.team_id_2 ?? session?.team_id_2 ?? null,
  ].filter((v): v is string => !!v);

  // 팀원 보기용 — 이름·파트만 전달(연락처 등 민감정보 제외)
  const memberList = members.map((m) => ({
    id: m.id,
    name: m.name,
    part: m.part,
    team_id: m.team_id,
    team_id_2: m.team_id_2,
  }));

  return (
    <>
      <div className="page-head">
        <h1>합주곡</h1>
        <p>팀별 합주곡 · 곡 선정 · 유튜브 · 투표</p>
      </div>
      <SetlistView teams={teams} initial={songs} myTeamIds={myTeamIds} members={memberList} />
    </>
  );
}
