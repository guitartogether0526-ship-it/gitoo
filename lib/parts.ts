/**
 * 악기(담당 파트) 선택 옵션 — 회원가입·마이페이지 공용.
 * 옵션을 바꾸면 여기 한 곳만 수정하면 된다.
 */
export const PARTS = ["기타", "베이스", "드럼", "보컬", "키보드", "투게더"];

/** "기타 · 베이스" 처럼 악기1·악기2를 한 줄로 표시 (악기2 없으면 악기1만) */
export function partLabel(part: string, part2?: string | null): string {
  return part2 ? `${part} · ${part2}` : part;
}
