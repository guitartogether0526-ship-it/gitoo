import type { Metadata } from "next";
import SoundGuide from "@/components/SoundGuide";
import { getSoundGuide } from "@/lib/db";

export const metadata: Metadata = {
  title: "음향 사용방법 · 기타투게더",
  description: "합주실 믹서 · 모니터 앰프 켜기/끄기 · 연결 · 모니터 조절 안내",
};
// 로그인 없이 공개되는 안내 페이지 (AuthGate PUBLIC_PATHS). QR로 공유.
// 배치도·모니터 표·문장은 운영진이 /sound-guide/edit 에서 편집(app_settings).
// getSoundGuide 가 태그 캐시라 매 요청 DB를 치지 않고, 저장 시에만 갱신된다.
export default async function SoundGuidePage() {
  const { data } = await getSoundGuide();
  return (
    <>
      <div className="page-head">
        <h1>음향 사용방법</h1>
        <p>처음 오신 분도 이 순서대로만 하면 됩니다 · 믹서 옆 QR과 같은 내용</p>
      </div>
      <SoundGuide data={data} />
    </>
  );
}
