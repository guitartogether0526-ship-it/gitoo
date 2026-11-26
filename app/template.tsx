// 화면 이동 애니메이션 — template은 페이지를 옮길 때마다 새로 그려지므로, 감싼 div의 CSS 등장 효과가 매번 재생된다.
// (같은 화면에서 ?ym= 같은 검색값만 바뀔 때는 다시 그려지지 않아 깜빡이지 않는다)
export default function Template({ children }: { children: React.ReactNode }) {
  return <div className="page-enter">{children}</div>;
}
