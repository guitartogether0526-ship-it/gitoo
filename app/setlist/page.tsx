import { getSongs, getTeams, getMembers, getSongVotes } from "@/lib/db";
import { getSession } from "@/lib/session";
import SetlistView from "@/components/SetlistView";

export const dynamic = "force-dynamic";

export default async function SetlistPage() {
  const [teams, rawSongs, members, session, votes] = await Promise.all([
    getTeams(),
    getSongs(),
    getMembers(),
    getSession(),
    getSongVotes(),
  ]);

  // 좋아요 = song_votes 집계(1인 1투표) — likes는 곡별 투표 수, voted는 "내가" 눌렀는지
  const likeCount = new Map<string, number>();
  const myVotes = new Set<string>();
  for (const v of votes) {
    likeCount.set(v.song_id, (likeCount.get(v.song_id) ?? 0) + 1);
    if (session && v.member_id === session.id) myVotes.add(v.song_id);
  }
  const songs = rawSongs.map((s) => ({
    ...s,
    likes: likeCount.get(s.id) ?? 0,
    voted: myVotes.has(s.id),
  }));

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
    part2: m.part2 ?? null,
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
