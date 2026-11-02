import ScheduleEditor from "@/components/ScheduleEditor";
import { getSchedule } from "@/lib/db";
import { kstParts } from "@/lib/date";
import { can } from "@/lib/roles";
import { getSession } from "@/lib/session";

export const dynamic = "force-dynamic";

// 일정관리 — 운영진 전용. 월별 정기모임 일정을 주차별로 입력하고 공지용 이미지(PNG)로 내려받는다.
export default async function SchedulePage({ searchParams }: { searchParams: Promise<{ ym?: string }> }) {
  const { ym: q } = await searchParams;
  const { y, m } = kstParts();
  const ym = q && /^\d{4}-\d{2}$/.test(q) ? q : `${y}-${String(m).padStart(2, "0")}`;
  const [session, { rows }] = await Promise.all([getSession(), getSchedule(ym)]);
  if (!can.manageMembers(session?.role)) {
    return (
      <div className="card">
        <p className="guide-note">운영진만 볼 수 있습니다.</p>
      </div>
    );
  }
  return (
    <>
      <div className="page-head">
        <h1>일정관리</h1>
        <p>주차별 일시·주제·내용을 입력하고 저장합니다. 이미지 저장으로 공지용 PNG를 받습니다.</p>
      </div>
      <ScheduleEditor key={ym} ym={ym} initial={rows} />
    </>
  );
}
