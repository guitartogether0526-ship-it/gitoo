import SoundGuideEditor from "@/components/SoundGuideEditor";
import { getSoundGuide } from "@/lib/db";
import { can } from "@/lib/roles";
import { getSession } from "@/lib/session";

export const dynamic = "force-dynamic";

// 음향 사용방법 편집 — 운영진 전용. 배치도(드래그) · 모니터 앰프 표.
export default async function SoundGuideEditPage() {
  const [session, data] = await Promise.all([getSession(), getSoundGuide()]);
  if (!can.manageMembers(session?.role)) {
    return (
      <div className="card">
        <p className="guide-note">운영진만 수정할 수 있습니다.</p>
      </div>
    );
  }
  return (
    <>
      <div className="page-head">
        <h1>음향 사용방법 수정</h1>
        <p>배치도의 앰프·자리를 끌어서 옮기고, 아래 표에서 이름을 고칩니다. 저장을 눌러야 반영됩니다.</p>
      </div>
      <SoundGuideEditor initial={data} />
    </>
  );
}
