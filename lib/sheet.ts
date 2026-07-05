import "server-only";

/**
 * 구글시트 회비 장부 연동 (읽기 전용).
 *
 * 총무가 관리하는 링크 공개 스프레드시트를 익명으로 읽어 회비 페이지에
 * 반영한다. LiveRefresh(회비 페이지 60초 주기)마다 서버 컴포넌트가 다시 fetch하므로
 * 총무가 시트를 수정하면 별도 작업 없이 자동 반영된다. (API 키 불필요)
 *
 * 시트 구조 — 탭 하나 = 한 달("26년 7월" 등), "양식" 탭이 원본 템플릿:
 *   B열 "성명" 헤더 아래 = 회원 이름, C열 = 납부액 (빈칸=미납, "-" 등 텍스트=선납 표기)
 *   B열 "합계" 행의 C = 수입 총액
 *   E열 "내역" 헤더 아래 = 지출 항목, F열 = 지출액 (환급·캐시백은 음수)
 *   E열 "합계" 행의 F = 지출 총액 · "이월금액" 행의 F = 전월 이월 · "총합계" 행의 F = 잔액
 *   B열 "특이사항" 아래 = 비고 (B=이름, C=내용)
 *
 * ⚠️ 행 번호는 달마다 다르다(회원 수 변동, gviz가 앞쪽 빈 행 제거) — 반드시 라벨로 찾는다.
 * ⚠️ 파서는 성명/내역/합계/이월금액/총합계/특이사항 라벨 문자열에 의존한다. 총무가
 *    라벨을 바꾸면 그 달은 "읽지 못함" 안내로 표시된다(앱은 죽지 않음).
 */

export const SHEET_ID = "1IAy5V96pOl6Oxdctts5zPX97c8zb36E0KjQa9igfQpk";
export const SHEET_URL = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/edit`;

/** 시트 탭 (한 달 장부) */
export interface SheetTab {
  name: string; // 예: "26년 7월", "9월 MT"
  gid: string;
}

export interface SheetMember {
  name: string;
  amount: number | null; // 납부액 — 숫자가 아니면 null
  raw: string; // C열 표시 텍스트 ("-" 등 선납 표기 — 빈칸이면 미납)
}

export interface SheetExpense {
  item: string;
  amount: number | null;
}

export interface SheetNote {
  name: string;
  note: string;
}

/** 한 달치 파싱 결과 */
export interface MonthSheet {
  members: SheetMember[];
  expenses: SheetExpense[];
  incomeTotal: number | null; // 수입 합계
  expenseTotal: number | null; // 지출 합계
  carryover: number | null; // 전월 이월금액
  grandTotal: number | null; // 총합계 = 이월 + 수입 − 지출
  notes: SheetNote[];
  recognized: boolean; // 양식 레이아웃으로 인식됐는지 (MT 등 비정형 탭 대비)
}

async function fetchText(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, { cache: "no-store", signal: AbortSignal.timeout(8000) });
    if (!res.ok) return null;
    return await res.text();
  } catch {
    return null; // 타임아웃·네트워크 오류 — 호출부에서 안내 카드로 처리
  }
}

/** 시트 탭 목록 (시트 순서 그대로 = 최신 달이 앞). 실패 시 null. */
export async function fetchSheetTabs(): Promise<SheetTab[] | null> {
  const html = await fetchText(`https://docs.google.com/spreadsheets/d/${SHEET_ID}/htmlview`);
  if (!html) return null;
  const tabs: SheetTab[] = [];
  // htmlview 페이지의 시트 메뉴 스크립트: items.push({name: "26년 7월", pageUrl: "...gid=NNN...
  const re = /items\.push\(\{name: "([^"]+)", pageUrl: "[^"]*gid=(\d+)/g;
  for (const m of html.matchAll(re)) {
    if (m[1] !== "양식") tabs.push({ name: m[1], gid: m[2] });
  }
  return tabs.length > 0 ? tabs : null;
}

type GvizCell = { v?: unknown; f?: string } | null | undefined;

const cellStr = (c: GvizCell) => String(c?.v ?? "").trim();
const cellNum = (c: GvizCell) => (typeof c?.v === "number" ? c.v : null);

/** 한 달(탭 gid) 데이터를 gviz JSON으로 읽어 라벨 기반으로 파싱. 실패 시 null. */
export async function fetchMonthSheet(gid: string): Promise<MonthSheet | null> {
  const text = await fetchText(
    `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:json&gid=${gid}&headers=0&range=A1:F100`,
  );
  if (!text) return null;

  let rows: { c?: GvizCell[] }[];
  try {
    // 응답은 google.visualization.Query.setResponse({...}); 래퍼로 감싸져 있다
    const json = JSON.parse(text.slice(text.indexOf("(") + 1, text.lastIndexOf(")")));
    if (!json?.table?.rows) return null; // 오류 응답(비공개 전환 등)
    rows = json.table.rows;
  } catch {
    return null;
  }

  const members: SheetMember[] = [];
  const expenses: SheetExpense[] = [];
  const notes: SheetNote[] = [];
  let incomeTotal: number | null = null;
  let expenseTotal: number | null = null;
  let carryover: number | null = null;
  let grandTotal: number | null = null;
  let inMembers = false;
  let membersDone = false;
  let inNotes = false;
  let inExpenses = false;
  let expensesDone = false;

  // B·C열(회비)과 E·F열(지출)은 같은 행을 공유하는 독립 리스트 — 라벨 분기가 수집보다 먼저
  for (const row of rows) {
    const c = row.c ?? [];
    const b = cellStr(c[1]); // B열
    const e = cellStr(c[4]); // E열

    if (b === "성명") inMembers = true;
    else if (b === "합계") {
      incomeTotal = cellNum(c[2]);
      membersDone = true;
    } else if (b === "특이사항") {
      inNotes = true;
      membersDone = true;
    } else if (inNotes && b) notes.push({ name: b, note: cellStr(c[2]) });
    else if (inMembers && !membersDone && b)
      members.push({ name: b, amount: cellNum(c[2]), raw: cellStr(c[2]) });

    if (e === "내역") inExpenses = true;
    else if (e === "합계") {
      expenseTotal = cellNum(c[5]);
      expensesDone = true;
    } else if (e === "이월금액") carryover = cellNum(c[5]);
    else if (e === "총합계") grandTotal = cellNum(c[5]);
    else if (e.startsWith("*")) {
      // "* 지출내역" · "* 총합계산" 등 섹션 제목 — 무시
    } else if (inExpenses && !expensesDone && e) expenses.push({ item: e, amount: cellNum(c[5]) });
  }

  // 합계 라벨이 비어 있으면 항목 합산으로 폴백
  if (incomeTotal === null && members.length > 0)
    incomeTotal = members.reduce((s, m) => s + (m.amount ?? 0), 0);
  if (expenseTotal === null && expenses.length > 0)
    expenseTotal = expenses.reduce((s, x) => s + (x.amount ?? 0), 0);
  if (grandTotal === null && carryover !== null && incomeTotal !== null && expenseTotal !== null)
    grandTotal = carryover + incomeTotal - expenseTotal;

  return {
    members,
    expenses,
    incomeTotal,
    expenseTotal,
    carryover,
    grandTotal,
    notes,
    recognized: inMembers || inExpenses,
  };
}
