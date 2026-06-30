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

/** Supabase select 헬퍼: 실패하면 fallback 반환 */
async function read<T>(table: string, fallback: T[]): Promise<T[]> {
  const sb = getSupabase();
  if (!sb) return fallback;
  const { data, error } = await sb.from(table).select("*");
  if (error || !data || data.length === 0) return fallback;
  return data as T[];
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
  return read<Team>("teams", TEAMS);
}

export async function getSongs(): Promise<Song[]> {
  const rows = await read<Song>("songs", SONGS);
  return rows.slice().sort((a, b) => byKo(a.title, b.title));
}

export async function getMembers(): Promise<Member[]> {
  const rows = await getAllMembers();
  return rows.slice().sort((a, b) => byKo(a.name, b.name));
}

export async function getDues(): Promise<DuesPayment[]> {
  return read<DuesPayment>("dues", DUES);
}

export async function getExpenses(): Promise<Expense[]> {
  const rows = await read<Expense>("expenses", EXPENSES);
  return rows.slice().sort((a, b) => a.date.localeCompare(b.date));
}
