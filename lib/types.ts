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
  author: string; // 작성자 표시명
  author_id: string | null; // 작성자 회원 id (수정 권한 판별용, 시드/익명글은 null)
  pinned: boolean; // 상단 고정
  created_at: string; // ISO date
}

/** 연습실은 1개 — 날짜+시간 단위 예약(캘린더 등록) */
export interface Reservation {
  id: string;
  date: string; // YYYY-MM-DD (MT 등 여러 날 예약이면 시작 날짜)
  end_date?: string | null; // YYYY-MM-DD — MT(1박2일 등) 종료 날짜. 없으면 당일 예약
  time_label: string; // 예: "19:00 - 21:00" (MT는 "1박2일" 등 기간 라벨)
  reserved_by: string;
  purpose: string; // 합주/개인연습/레슨/정기공연/MT/운영진회의
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
  sort_order?: number; // 탭 표시 순서(운영진 드래그로 변경). 미설정 시 이름순.
}

export interface Song {
  id: string;
  team_id: string; // 소속 팀
  title: string;
  artist: string;
  youtube_url: string | null; // 유튜브 링크
  parts: string[]; // 담당 파트 목록 (레거시)
  sheets: SheetMusic[]; // 악보 (레거시)
  likes: number;
  voted: boolean;
  status: "candidate" | "confirmed"; // 후보 / 선정(확정)
}

/** 권한 등급 (높은 → 낮은): 관리자(admin) · 회장 · 총무 · STAFF · 회원 */
export type MemberRole = "admin" | "president" | "treasurer" | "staff" | "member";
export type MemberStatus = "active" | "rest";

export interface Member {
  id: string;
  name: string;
  phone: string; // 휴대폰번호
  email: string; // 이메일 (아이디/비밀번호 찾기 발송용)
  part: string; // 담당 파트 (기타/베이스/드럼/보컬/키보드 등)
  status: MemberStatus;
  role: MemberRole; // 권한 등급
  initial: string; // 아바타 이니셜
  username: string; // 로그인 아이디
  approved: boolean; // 관리자 승인 여부 (false = 가입 승인 대기)
  team_id: string | null; // 소속 팀1 (운영진이 배정, 미배정 = null)
  team_id_2: string | null; // 소속 팀2 (한 사람이 2개 팀 참여, 없으면 null)
}

/** 로그인 세션 사용자 (쿠키에 저장 — 비밀번호 등 민감정보 미포함) */
export interface SessionUser {
  id: string;
  name: string;
  role: MemberRole;
  part: string;
  initial: string;
  team_id: string | null; // 소속 팀1 (운영진 배정)
  team_id_2: string | null; // 소속 팀2 (한 사람이 2개 팀 참여, 없으면 null)
}

export interface DuesPayment {
  member_name: string;
  part?: string; // 담당 파트 — 회원 목록에서 채운 표시용(선택)
  cohort: number; // (레거시·미사용) 기수
  paid: boolean;
  month: string; // "YYYY-MM"
}

export interface Expense {
  id: string;
  date: string;
  item: string;
  amount: number; // 음수 = 지출, 양수 = 수입(회비)
  has_receipt?: boolean; // (레거시) 영수증 첨부 여부 — UI에서는 미사용
}
