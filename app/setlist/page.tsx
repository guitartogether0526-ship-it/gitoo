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

  // 로그인한 회원의 팀 (본인팀 곡만 수정·삭제 가능; 운영진은 전체)
  const me = members.find((m) => m.id === session?.id);
  const myTeamId = me?.team_id ?? session?.team_id ?? null;

  return (
    <>
      <div className="page-head">
        <h1>합주곡 · 셋리스트</h1>
        <p>팀별 셋리스트 · 곡 선정 · 유튜브 · 투표</p>
      </div>
      <SetlistView teams={teams} initial={songs} myTeamId={myTeamId} />
    </>
  );
}
