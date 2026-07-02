import { getReservations, getMembers, getTeams } from "@/lib/db";
import { getSession } from "@/lib/session";
import ReservationCalendar from "@/components/ReservationCalendar";
import AvailabilityChecker from "@/components/AvailabilityChecker";

export const dynamic = "force-dynamic";

export default async function ReservationPage() {
  const [reservations, session, members, teams] = await Promise.all([
    getReservations(),
    getSession(),
    getMembers(),
    getTeams(),
  ]);

  // 로그인한 회원의 팀명(최대 2개, 미배정/관리자면 빈 배열) — 예약자 선택지에 사용
  const me = members.find((m) => m.id === session?.id);
  const myTeamIds = [
    me?.team_id ?? session?.team_id ?? null,
    me?.team_id_2 ?? session?.team_id_2 ?? null,
  ].filter((v): v is string => !!v);
  const myTeamNames = myTeamIds
    .map((id) => teams.find((t) => t.id === id)?.name)
    .filter((v): v is string => !!v);

  return (
    <>
      <div className="page-head">
        <h1>연습실 예약</h1>
        <p>캘린더에서 날짜를 골라 예약하세요.</p>
      </div>
      <AvailabilityChecker myTeamNames={myTeamNames} />
      <ReservationCalendar initial={reservations} myTeamNames={myTeamNames} />
    </>
  );
}
