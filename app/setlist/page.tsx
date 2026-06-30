import { getSongs, getTeams } from "@/lib/db";
import SetlistView from "@/components/SetlistView";

export const dynamic = "force-dynamic";

export default async function SetlistPage() {
  const [teams, songs] = await Promise.all([getTeams(), getSongs()]);
  return (
    <>
      <div className="page-head">
        <h1>합주곡 · 악보</h1>
        <p>팀별 셋리스트 · 곡 선정 · 파트별 악보 · 투표</p>
      </div>
      <SetlistView teams={teams} initial={songs} />
    </>
  );
}
