import Link from "next/link";
import CuesheetEditor from "@/components/CuesheetEditor";
import { getCuesheet, getTeams, listCuesheets } from "@/lib/db";
import { createCuesheet } from "@/lib/cuesheet-actions";
import { kstYmd } from "@/lib/date";
import { can } from "@/lib/roles";
import { getSession } from "@/lib/session";
import { teamCategory } from "@/lib/types";

export const dynamic = "force-dynamic";

// 큐시트 — 운영진 전용. 공연별로 정기공연 팀마다 믹서·이펙터 세팅을 기록하고 공연 중 보면서 조정한다.
export default async function CuesheetPage({ searchParams }: { searchParams: Promise<{ id?: string }> }) {
  const { id } = await searchParams;
  const session = await getSession();
  if (!can.manageMembers(session?.role)) {
    return (
      <div className="card">
        <p className="guide-note">운영진만 볼 수 있습니다.</p>
      </div>
    );
  }

  if (id) {
    const [sheet, teams] = await Promise.all([getCuesheet(id), getTeams()]);
    if (!sheet) {
      return (
        <div className="card">
          <p className="guide-note">큐시트를 찾을 수 없습니다.</p>
          <Link href="/cuesheet" className="btn btn-sm">목록으로</Link>
        </div>
      );
    }
    const regular = teams.filter((t) => teamCategory(t) === "정기공연").map((t) => ({ id: t.id, name: t.name }));
    return <CuesheetEditor key={id} id={id} initial={sheet} teams={regular} />;
  }

  const list = await listCuesheets();
  return (
    <>
      <div className="page-head">
        <h1>큐시트</h1>
        <p>리허설 때 팀별 믹서 · 이펙터 세팅을 기록하고, 공연 중 보면서 조정합니다.</p>
      </div>
      <form className="card form-grid" action={createCuesheet}>
        <div className="field">
          <label htmlFor="cue-title">공연 이름</label>
          <input id="cue-title" name="title" className="input" maxLength={60} required placeholder="12월 정기공연" />
        </div>
        <div className="field">
          <label htmlFor="cue-date">날짜</label>
          <input id="cue-date" name="date" type="date" className="input" required defaultValue={kstYmd()} />
        </div>
        <button className="btn amber btn-sm" type="submit">새 큐시트</button>
      </form>
      {list.length === 0 ? (
        <div className="card">
          <p className="guide-note">아직 큐시트가 없습니다.</p>
        </div>
      ) : (
        list.map((c) => (
          <Link key={c.id} href={`/cuesheet?id=${c.id}`} className="card cue-item">
            <strong>{c.title}</strong>
            <span>{c.date}</span>
          </Link>
        ))
      )}
    </>
  );
}
