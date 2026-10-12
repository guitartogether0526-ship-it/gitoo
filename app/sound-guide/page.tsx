import type { Metadata } from "next";
import SoundGuide from "@/components/SoundGuide";

export const metadata: Metadata = {
  title: "음향 사용방법 · 기타투게더",
  description: "합주실 믹서 · 모니터 앰프 켜기/끄기 · 연결 · 모니터 조절 안내",
};

// 로그인 없이 공개되는 정적 안내 페이지 (AuthGate PUBLIC_PATHS). QR로 공유.
export default function SoundGuidePage() {
  return (
    <>
      <div className="page-head">
        <h1>음향 사용방법</h1>
        <p>처음 오신 분도 이 순서대로만 하면 됩니다 · 믹서 옆 QR과 같은 내용</p>
      </div>
      <SoundGuide />
    </>
  );
}
