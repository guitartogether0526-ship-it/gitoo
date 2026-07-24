import type { Board, Post, Reservation, Team, Song } from "./types";

/**
 * 목업 데이터 — 각 배열은 Supabase 테이블의 행(row) 집합을 모방한다.
 * 실제 연동 시 이 파일은 제거되고 lib/db.ts 가 supabase client 를 호출한다.
 */

// 게시판 — 공지사항은 기본 게시판(is_notice). 운영진이 게시판을 추가할 수 있다.
export const BOARDS: Board[] = [
  { id: "b1", name: "공지사항", is_notice: true, created_at: "2026-01-01T00:00:00Z" },
  { id: "b2", name: "자유게시판", is_notice: false, created_at: "2026-02-01T00:00:00Z" },
  { id: "b3", name: "건의사항", is_notice: false, created_at: "2026-03-01T00:00:00Z" },
];

export const POSTS: Post[] = [
  {
    id: "p1",
    board_id: "b1",
    title: "🎸 6월 정기 합주 일정 안내",
    body: "이번 달 정기 합주는 6월 28일(토) 오후 3시, 1번 연습실에서 진행됩니다. 셋리스트 투표를 미리 마감해 주세요!",
    author: "운영진 김지윤",
    author_id: null,
    pinned: true,
    created_at: "2026-06-25T09:00:00Z",
  },
  {
    id: "p2",
    board_id: "b1",
    title: "회비 납부 안내 (6월)",
    body: "6월 회비(월 20,000원) 납부 기한은 6월 30일입니다. 미납 회원분들은 총무에게 문의 바랍니다.",
    author: "총무 박서준",
    author_id: null,
    pinned: false,
    created_at: "2026-06-15T08:00:00Z",
  },
  {
    id: "p3",
    board_id: "b2",
    title: "이번 주말 번개 합주 하실 분?",
    body: "토요일 저녁에 합주실 비면 같이 잼 하실 분 댓글 주세요 🎶",
    author: "이도윤",
    author_id: null,
    pinned: false,
    created_at: "2026-06-22T18:00:00Z",
  },
];

// 연습실 1개 — 캘린더에 날짜별로 등록된 예약들 (2026-06 기준)
// ⚠️ purpose 는 실제 로직과 같은 문자열("합주"/"개인연습")을 쓴다 — 홈 필터·푸시 분기가 이 값으로 매칭
export const RESERVATIONS: Reservation[] = [
  { id: "rv1", date: "2026-06-28", time_label: "15:00 - 18:00", reserved_by: "록 밴드 A", purpose: "합주" },
  { id: "rv2", date: "2026-06-30", time_label: "19:00 - 21:00", reserved_by: "나", purpose: "개인연습" },
  { id: "rv3", date: "2026-07-02", time_label: "20:00 - 22:00", reserved_by: "어쿠스틱 팀", purpose: "합주" },
  { id: "rv4", date: "2026-07-05", time_label: "14:00 - 16:00", reserved_by: "이도윤", purpose: "개인연습" },
  { id: "rv5", date: "2026-07-05", time_label: "18:00 - 20:00", reserved_by: "재즈 합주반", purpose: "합주" },
];

// 합주 팀(밴드) — 셋리스트 탭으로 사용
export const TEAMS: Team[] = [
  { id: "t1", name: "1팀", sort_order: 0 },
  { id: "t2", name: "2팀", sort_order: 1 },
  { id: "t3", name: "3팀", sort_order: 2 },
];

export const SONGS: Song[] = [
  {
    id: "s1",
    team_id: "t1",
    title: "Bohemian Rhapsody",
    artist: "Queen",
    youtube_url: "https://www.youtube.com/watch?v=fJ9rUzIMcZQ",
    likes: 18,
    voted: false,
    status: "confirmed",
  },
  {
    id: "s2",
    team_id: "t1",
    title: "Don't Look Back in Anger",
    artist: "Oasis",
    youtube_url: "https://www.youtube.com/watch?v=r8OipmKFDeM",
    likes: 24,
    voted: true,
    status: "candidate",
  },
  {
    id: "s3",
    team_id: "t2",
    title: "밤편지",
    artist: "아이유",
    youtube_url: "https://www.youtube.com/watch?v=BzYnNdJhZQw",
    likes: 31,
    voted: false,
    status: "confirmed",
  },
  {
    id: "s4",
    team_id: "t2",
    title: "사랑했지만",
    artist: "김광석",
    youtube_url: "https://www.youtube.com/watch?v=Sx4Y6Bd5Ut0",
    likes: 12,
    voted: false,
    status: "candidate",
  },
  {
    id: "s5",
    team_id: "t3",
    title: "Fly Me to the Moon",
    artist: "Frank Sinatra",
    youtube_url: "https://www.youtube.com/watch?v=ZEcqHA7dbwM",
    likes: 9,
    voted: false,
    status: "candidate",
  },
];
