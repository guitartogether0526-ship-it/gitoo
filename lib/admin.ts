import type { SessionUser } from "./types";

/**
 * 관리자(admin) 계정 — 모든 권한 보유.
 * 비밀번호는 서버에서만 검증한다(lib/auth-actions.ts). 여기엔 민감정보 없음.
 */
export const ADMIN_USER: SessionUser = {
  id: "admin",
  name: "admin",
  role: "admin",
  part: "운영",
  initial: "A",
  team_id: null,
  team_id_2: null,
};
