import type { MemberRole } from "./types";

/**
 * 권한 모델 (서버/클라이언트 공용 — "use client" 없음).
 *
 *  | 권한            | 회장 | 총무 | STAFF | 회원 |
 *  |-----------------|:---:|:---:|:-----:|:---:|
 *  | 회비/장부 편집  |  ✓  |  ✓  |   ✗   |  ✗  |  (STAFF·회원은 읽기 전용)
 *  | 회원 관리       |  ✓  |  ✓  |   ✓   |  ✗  |
 *  | 합주실 예약 관리 |  ✓  |  ✓  |   ✓   |  ✗  |  (회원은 본인 예약만)
 *  | 공지 작성       |  ✓  |  ✓  |   ✓   |  ✗  |
 *  | 게시판 추가     |  ✓  |  ✓  |   ✓   |  ✗  |
 */

export const ROLE_LABEL: Record<MemberRole, string> = {
  admin: "관리자",
  president: "회장",
  treasurer: "총무",
  staff: "STAFF",
  member: "회원",
};

// 회원 권한 변경 드롭다운 순서 (admin 은 특수 계정이라 제외)
export const ROLE_ORDER: MemberRole[] = ["president", "treasurer", "staff", "member"];

const isStaffOrAbove = (r?: MemberRole | null) =>
  r === "admin" || r === "president" || r === "treasurer" || r === "staff";

/** 각 행동에 대한 허용 여부 (admin 은 모든 권한) */
export const can = {
  /** 회비·장부 편집 (납부 토글, 지출 추가) — 관리자·회장·총무 */
  editFinance: (r?: MemberRole | null) =>
    r === "admin" || r === "president" || r === "treasurer",
  /** 회원 관리 (권한 변경 등) — STAFF 이상 */
  manageMembers: (r?: MemberRole | null) => isStaffOrAbove(r),
  /** 합주실 예약 관리 (타인 예약 취소 등) — STAFF 이상 */
  manageReservations: (r?: MemberRole | null) => isStaffOrAbove(r),
  /** 공지사항 작성 — STAFF 이상 */
  writeNotice: (r?: MemberRole | null) => isStaffOrAbove(r),
  /** 게시판 추가 — STAFF 이상 */
  manageBoards: (r?: MemberRole | null) => isStaffOrAbove(r),
};
