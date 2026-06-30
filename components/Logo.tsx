/**
 * image_2.png 로고 재현 — 흰색 프레임 + "GUITAR" / 구분선 / "TOGETHER".
 * 좌측 상단 헤더에 배치된다.
 */
export default function Logo() {
  return (
    <div className="logo-frame" aria-label="GUITAR TOGETHER">
      <span className="lg-top">GUITAR</span>
      <span className="lg-rule" />
      <span className="lg-bot">TOGETHER</span>
    </div>
  );
}
