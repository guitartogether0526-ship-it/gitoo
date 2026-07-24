/**
 * KST(Asia/Seoul) 기준 날짜 헬퍼.
 *
 * ⚠️ 서버(Vercel = UTC)든 브라우저든, `new Date()`/`toISOString()`는 실행 환경의
 *    타임존을 따른다. 배포 서버는 UTC라 한국시간으로 자정 직후엔 "어제/지난 달"이
 *    나오는 버그가 생긴다. 화면에 보이는 "오늘/이번 달"은 반드시 이 헬퍼를 써서
 *    한국시간 기준으로 계산할 것.
 */
const KST_TZ = "Asia/Seoul";

/** 오늘(또는 주어진 시점)의 KST "YYYY-MM-DD" */
export function kstYmd(base: Date = new Date()): string {
  // en-CA 로캘은 YYYY-MM-DD 포맷을 준다.
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: KST_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(base);
}

/** KST 기준 { y, m, d } (m: 1~12) */
export function kstParts(base: Date = new Date()): { y: number; m: number; d: number } {
  const [y, m, d] = kstYmd(base).split("-").map(Number);
  return { y, m, d };
}

/** "2026-07-11" → "7월 11일(토)" — 날짜 문자열 표시용 (실행 타임존 무관) */
export function koDateLabel(ymd: string): string {
  const [y, m, d] = ymd.split("-").map(Number);
  const day = ["일", "월", "화", "수", "목", "금", "토"][new Date(Date.UTC(y, m - 1, d)).getUTCDay()];
  return `${m}월 ${d}일(${day})`;
}
