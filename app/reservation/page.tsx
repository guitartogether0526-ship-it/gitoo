import { getReservations } from "@/lib/db";
import ReservationCalendar from "@/components/ReservationCalendar";

export default async function ReservationPage() {
  const reservations = await getReservations();
  return (
    <>
      <div className="page-head">
        <h1>연습실 예약</h1>
        <p>연습실 1실 · 캘린더에서 날짜를 골라 예약하세요.</p>
      </div>
      <ReservationCalendar initial={reservations} />
    </>
  );
}
