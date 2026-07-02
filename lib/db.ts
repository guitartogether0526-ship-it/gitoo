import { BOARDS, POSTS, RESERVATIONS, TEAMS, SONGS, DUES, EXPENSES } from "./mock-data";
import type {
  Board,
  Post,
  Reservation,
  Team,
  Song,
  Member,
  DuesPayment,
  Expense,
} from "./types";
import { getSupabase } from "./supabase";
import { getAllMembers } from "./member-store";
import { kstYearMonth } from "./date";

/**
 * 데이터 접근 계층 (Data Access Layer).
 *
 * - Supabase 가 설정되어 있으면 실제 테이블에서 읽는다.
 * - 미설정(또는 테이블 부재 등 오류) 시 목업 데이터로 폴백 → 항상 동작.
 *
 * 스키마: supabase/schema.sql 참고. 컬럼명은 여기 타입(snake_case)과 1:1 매핑.
 */

// 가나다순 정렬 헬퍼 (한글 로캘)
const byKo = (a: string, b: string) => a.localeCompare(b, "ko");

let warnedNoSupabase = false;

/**
 * Supabase select 헬퍼.
 * - 미연결(env 없음): 목업(fallback) 반환 + 1회 경고. (env 추가 후 dev 서버 재시작 필요)
 * - 연결됨: 실제 DB 결과를 그대로 반환(빈 테이블이면 빈 배열). 오류 시에만 목업 폴백.
 *   ⚠️ 빈 테이블을 목업으로 되돌리지 않음 — 안 그러면 시드 목업이 계속 되살아나 삭제가 안 되는 것처럼 보임.
 */
async function read<T>(table: string, fallback: T[]): Promise<T[]> {
  const sb = getSupabase();
  if (!sb) {
    if (!warnedNoSupabase) {
      warnedNoSupabase = true;
      console.warn(
        "[db] Supabase 미연결 — 목업 데이터로 동작 중입니다. 추가/삭제가 저장되지 않습니다. " +
          ".env.local 설정 후 dev 서버를 재시작(또는 배포 환경변수 설정)하세요.",
      );
    }
    return fallback;
  }
  const { data, error } = await sb.from(table).select("*");
  if (error) {
    console.error(`[db] '${table}' 조회 실패 — 목업으로 폴백:`, error.message);
    return fallback;
  }
  return (data as T[] | null) ?? [];
}

export async function getBoards(): Promise<Board[]> {
  const rows = await read<Board>("boards", BOARDS);
  // 공지사항 게시판을 맨 앞에, 이후 생성순
  return rows.slice().sort((a, b) =>
    a.is_notice === b.is_notice
      ? a.created_at.localeCompare(b.created_at)
      : a.is_notice
        ? -1
        : 1,
  );
}

export async function getPosts(): Promise<Post[]> {
  const rows = await read<Post>("posts", POSTS);
  // 상단 고정 우선, 이후 최신순
  return rows.slice().sort((a, b) =>
    a.pinned === b.pinned
      ? b.created_at.localeCompare(a.created_at)
      : a.pinned
        ? -1
        : 1,
  );
}

export async function getReservations(): Promise<Reservation[]> {
  const rows = await read<Reservation>("reservations", RESERVATIONS);
  return rows
    .slice()
    .sort((a, b) => a.date.localeCompare(b.date) || a.time_label.localeCompare(b.time_label));
}

export async function getTeams(): Promise<Team[]> {
  const rows = await read<Team>("teams", TEAMS);
  // 정렬 순서(sort_order) 우선, 미설정 시 이름순
  return rows
    .slice()
    .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0) || byKo(a.name, b.name));
}

export async function getSongs(): Promise<Song[]> {
  const rows = await read<Song>("songs", SONGS);
  return rows.slice().sort((a, b) => byKo(a.title, b.title));
}

export async function getMembers(): Promise<Member[]> {
  const rows = await getAllMembers();
  return rows.slice().sort((a, b) => byKo(a.name, b.name));
}

/**
 * 이번 달 회비 납부 현황.
 *
 * ⚠️ dues 테이블은 회원 명단과 별개라, 시딩/삽입되지 않으면 비어서 "아무도 안 보임".
 *    그래서 명단은 **회원 목록에서 이번 달 기준으로 생성**하고, 납부 여부만 dues
 *    테이블(회원 이름 + 월)에서 채운다. 대상: 승인된 활동(active) 회원.
 *    (납부 토글 시 dues 행을 insert/update — components/FinanceManager 참고)
 */
export async function getDues(): Promise<DuesPayment[]> {
  const month = kstYearMonth(); // "YYYY-MM"
  const [members, rows] = await Promise.all([
    getMembers(),
    read<DuesPayment>("dues", DUES),
  ]);
  const paidByName = new Map(
    rows.filter((r) => r.month === month).map((r) => [r.member_name, r.paid]),
  );
  return members
    .filter((m) => m.approved && m.status === "active")
    .map((m) => ({
      member_name: m.name,
      part: m.part,
      cohort: 0, // (레거시·미사용) 기수 컬럼 하위 호환용
      paid: paidByName.get(m.name) ?? false,
      month,
    }));
}

export async function getExpenses(): Promise<Expense[]> {
  const rows = await read<Expense>("expenses", EXPENSES);
  return rows.slice().sort((a, b) => a.date.localeCompare(b.date));
}
