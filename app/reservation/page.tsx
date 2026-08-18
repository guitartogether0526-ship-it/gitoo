import { getReservations, getMember, getTeams } from "@/lib/db";
import { getSession } from "@/lib/session";
import { kstYmd } from "@/lib/date";
import ReservationCalendar from "@/components/ReservationCalendar";
import AvailabilityChecker from "@/components/AvailabilityChecker";

export const dynamic = "force-dynamic";

export default async function ReservationPage() {
  const session = await getSession(); // 쿠키 읽기 — 네트워크 없음
  // 캘린더에서 볼 수 있는 범위만 — 전체 예약은 화면에 쓰지도 않으면서 새로고침을 늦춘다.
  // ponytail: 90일 이전 달로 넘기면 빈 달로 보인다. 더 필요해지면 보는 달에 맞춰 조회할 것.
  const from = kstYmd(new Date(Date.now() - 90 * 24 * 60 * 60 * 1000));
  const [reservations, me, teams] = await Promise.all([
    getReservations(from),
    session ? getMember(session.id) : null,
    getTeams(),
  ]);

  // 로그인한 회원의 팀명(최대 3개, 미배정/관리자면 빈 배열) — 예약자 선택지에 사용
  const myTeamIds = [
    me?.team_id ?? session?.team_id ?? null,
    me?.team_id_2 ?? session?.team_id_2 ?? null,
    me?.team_id_3 ?? session?.team_id_3 ?? null,
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
