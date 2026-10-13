/**
 * 페이지 이동 중 서버 렌더가 끝날 때까지 보여주는 로딩 화면 (Next.js 라우트 Suspense fallback).
 * .loading-screen 은 CSS로 0.4초 뒤에 나타나므로 빠른 이동에서는 깜빡이지 않는다.
 */
export default function Loading() {
  return (
    <div className="loading-screen" role="status" aria-label="불러오는 중">
      <span className="spinner" />
      <span className="dim" style={{ fontSize: 12 }}>불러오는 중…</span>
    </div>
  );
}
