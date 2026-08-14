import { BOARDS, POSTS, RESERVATIONS, TEAMS, SONGS } from "./mock-data";
import type { Board, Post, Reservation, Team, Song, Member } from "./types";
import { getSupabase } from "./supabase";
import { getSupabaseAdmin } from "./supabase-admin";
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

let warnedNoSupabase = false;

/**
 * Supabase select 헬퍼.
 * - 미연결(env 없음): 목업(fallback) 반환 + 1회 경고. (env 추가 후 dev 서버 재시작 필요)
 * - 연결됨: 실제 DB 결과를 그대로 반환(빈 테이블이면 빈 배열). 오류 시에만 목업 폴백.
 *   ⚠️ 빈 테이블을 목업으로 되돌리지 않음 — 안 그러면 시드 목업이 계속 되살아나 삭제가 안 되는 것처럼 보임.
 *
 * narrow: 서버에서 미리 걸러 오기 위한 필터(예: 다가오는 예약만). 화면에 안 쓸 행까지
 * 전량 받아오면 그대로 새로고침 대기시간이 된다.
 * ⚠️ 목업 폴백엔 필터가 적용되지 않는다(Supabase 미연결/오류 때만 쓰이는 경로) —
 *    호출부의 JS 필터를 지우지 말 것.
 */
async function read<T>(
  table: string,
  fallback: T[],
  narrow?: (q: any) => any,
): Promise<T[]> {
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
  const q = sb.from(table).select("*");
  const { data, error } = await (narrow ? narrow(q) : q);
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

/** pinnedOnly: 홈 화면처럼 상단 고정글만 필요할 때 — 전체 글을 받아오지 않는다. */
export async function getPosts(opts?: { pinnedOnly?: boolean }): Promise<Post[]> {
  const rows = await read<Post>(
    "posts",
    POSTS,
    opts?.pinnedOnly ? (q) => q.eq("pinned", true) : undefined,
  );
  // 상단 고정 우선, 이후 최신순
  return rows.slice().sort((a, b) =>
    a.pinned === b.pinned
      ? b.created_at.localeCompare(a.created_at)
      : a.pinned
        ? -1
        : 1,
  );
}

/**
 * from: "YYYY-MM-DD" 이후 시작하는 예약만 (미지정 시 전체).
 * ⚠️ 시작일 기준이라 from 이전에 시작해 걸쳐 있는 기간 예약(MT)은 빠진다 — 호출부가
 *    필요한 만큼 여유를 두고 from을 잡을 것.
 */
export async function getReservations(from?: string): Promise<Reservation[]> {
  const rows = await read<Reservation>(
    "reservations",
    RESERVATIONS,
    from ? (q) => q.gte("date", from) : undefined,
  );
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

/** confirmedOnly: 홈 화면처럼 선정곡만 필요할 때 — 후보곡까지 받아오지 않는다. */
export async function getSongs(opts?: { confirmedOnly?: boolean }): Promise<Song[]> {
  const rows = await read<Song>(
    "songs",
    SONGS,
    opts?.confirmedOnly ? (q) => q.eq("status", "confirmed") : undefined,
  );
  return rows.slice().sort((a, b) => byKo(a.title, b.title));
}

/**
 * 합주곡 좋아요 투표(1인 1투표) 전체.
 * song_votes는 공개 정책이 없어(투표 위조 방지) service_role로만 읽는다.
 * 테이블 미생성(schema.sql 미실행)·미연결 시 빈 배열 — 페이지는 좋아요 0으로 동작.
 */
export async function getSongVotes(): Promise<{ song_id: string; member_id: string }[]> {
  const sb = getSupabaseAdmin();
  if (!sb) return [];
  const { data } = await sb.from("song_votes").select("song_id,member_id");
  return data ?? [];
}

export async function getMembers(): Promise<Member[]> {
  const rows = await getAllMembers();
  return rows.slice().sort((a, b) => byKo(a.name, b.name));
}

/** 회원 1명 — "나"만 필요한 화면(홈·예약·마이페이지)에서 전체 명단 조회 대신 사용 */
export { getMemberById as getMember } from "./member-store";
