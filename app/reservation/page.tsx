import { getReservations, getMembers, getTeams } from "@/lib/db";
import { getSession } from "@/lib/session";
import ReservationCalendar from "@/components/ReservationCalendar";

export const dynamic = "force-dynamic";

export default async function ReservationPage() {
  const [reservations, session, members, teams] = await Promise.all([
    getReservations(),
    getSession(),
    getMembers(),
    getTeams(),
  ]);

  // 로그인한 회원의 팀명 (미배정/관리자면 null) — 예약자 선택지에 사용
  const me = members.find((m) => m.id === session?.id);
  const myTeamId = me?.team_id ?? session?.team_id ?? null;
  const myTeamName = teams.find((t) => t.id === myTeamId)?.name ?? null;

  return (
    <>
      <div className="page-head">
        <h1>연습실 예약</h1>
        <p>캘린더에서 날짜를 골라 예약하세요.</p>
      </div>
      <ReservationCalendar initial={reservations} myTeamName={myTeamName} />
    </>
  );
}
