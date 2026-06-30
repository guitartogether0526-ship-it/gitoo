/**
 * Supabase 테이블 스키마를 모방한 타입 정의.
 * 컬럼명은 Supabase 관례(snake_case, id/created_at)를 따른다.
 * 추후 `supabase gen types`로 자동 생성된 타입으로 교체 가능.
 */

/** 게시판 — 운영진이 추가 가능. 공지사항 게시판(is_notice)의 고정글은 홈에 노출 */
export interface Board {
  id: string;
  name: string;
  is_notice: boolean; // 공지사항 게시판 여부
  created_at: string; // ISO date
}

/** 게시글 — 특정 게시판에 속함 */
export interface Post {
  id: string;
  board_id: string;
  title: string;
  body: string;
  author: string;
  pinned: boolean; // 상단 고정
  created_at: string; // ISO date
}

/** 연습실은 1개 — 날짜+시간 단위 예약(캘린더 등록) */
export interface Reservation {
  id: string;
  date: string; // YYYY-MM-DD
  time_label: string; // 예: "19:00 - 21:00"
  reserved_by: string;
  purpose: string; // 합주/개인연습 등
}

export interface SheetMusic {
  part: string; // 담당 파트
  file_label: string;
  file_url: string;
}

/** 합주 팀(밴드) — 셋리스트가 팀별 탭으로 분리됨 */
export interface Team {
  id: string;
  name: string;
}

export interface Song {
  id: string;
  team_id: string; // 소속 팀
  title: string;
  artist: string;
  parts: string[]; // 담당 파트 목록
  sheets: SheetMusic[];
  likes: number;
  voted: boolean;
  status: "candidate" | "confirmed"; // 후보 / 선정(확정)
}

export type MemberRole = "member";
export type MemberStatus = "active" | "rest";

export interface Member {
  id: string;
  name: string;
  cohort: number; // 기수
  part: string; // 담당 파트 (기타/베이스/드럼/보컬/키보드 등)
  status: MemberStatus;
  is_staff: boolean; // 운영진
  is_treasurer: boolean; // 총무
  initial: string; // 아바타 이니셜
}

export interface DuesPayment {
  member_name: string;
  cohort: number;
  paid: boolean;
  month: string;
}

export interface Expense {
  id: string;
  date: string;
  item: string;
  amount: number; // 음수 = 지출, 양수 = 수입(회비)
  has_receipt: boolean;
}
