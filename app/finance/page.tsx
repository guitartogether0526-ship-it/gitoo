import { fetchMonthSheet, fetchSheetTabs, SHEET_URL } from "@/lib/sheet";
import { kstParts } from "@/lib/date";
import { getSession } from "@/lib/session";
import { can } from "@/lib/roles";
import FinanceView from "@/components/FinanceView";

export const dynamic = "force-dynamic";

/**
 * 회비 페이지 — 총무의 구글시트 장부를 읽기 전용으로 표시.
 * ?m=<gid> 로 볼 달을 선택한다 (기본 = 이번 달 탭, 없으면 최신 탭).
 */
export default async function FinancePage({
  searchParams,
}: {
  searchParams: Promise<{ m?: string }>;
}) {
  const { m } = await searchParams;
  const mParam = m && /^\d+$/.test(m) ? m : undefined;

  // 탭 목록과 (달이 선택돼 있으면) 그 달 데이터를 병렬로 — 페이지 진입·수동 새로고침마다 도는 경로
  const [tabs, prefetched, session] = await Promise.all([
    fetchSheetTabs(),
    mParam ? fetchMonthSheet(mParam) : Promise.resolve(null),
    getSession(),
  ]);
  // 납부 현황(이름별 명단)은 운영진(STAFF 이상) 전용
  const showDues = can.manageMembers(session?.role);

  const head = (
    <div className="page-head">
      <h1>회비 · 총무 장부</h1>
      <p>구글시트 장부 연동 · 자동 반영</p>
    </div>
  );

  if (!tabs) {
    return (
      <>
        {head}
        <div className="card">
          <p className="dim" style={{ margin: 0, fontSize: 13 }}>
            구글시트 장부를 불러오지 못했습니다. 잠시 후 다시 시도하거나 시트에서 직접 확인해
            주세요.
          </p>
          <a
            className="btn ghost btn-sm"
            href={SHEET_URL}
            target="_blank"
            rel="noopener noreferrer"
            style={{ marginTop: 10, display: "inline-flex" }}
          >
            구글시트 보기
          </a>
        </div>
      </>
    );
  }

  // 기본 달 = 이번 달 탭("26년 7월" 형식, KST), 없으면 가장 최신 탭
  const { y, m: mm } = kstParts();
  const defaultTab = tabs.find((t) => t.name === `${y % 100}년 ${mm}월`) ?? tabs[0];
  // ?m 을 탭 목록과 대조해 검증 — 잘못된 gid(양식 포함)는 기본 달로 폴백
  const selected = tabs.find((t) => t.gid === mParam) ?? defaultTab;
  const month = selected.gid === mParam ? prefetched : await fetchMonthSheet(selected.gid);
  // 일반 회원에게는 명단·특이사항을 응답에서 아예 제외 (합계 수치만 전달)
  const safeMonth = month && !showDues ? { ...month, members: [], notes: [] } : month;

  return (
    <>
      {head}

      <FinanceView
        tabs={tabs}
        selectedGid={selected.gid}
        monthName={selected.name}
        month={safeMonth}
        showDues={showDues}
        sheetUrl={SHEET_URL}
      />

      <p className="dim" style={{ fontSize: 11, textAlign: "center", marginTop: 12 }}>
        총무가 구글시트를 수정하면 약 1분 안에 자동 반영됩니다
      </p>
    </>
  );
}
