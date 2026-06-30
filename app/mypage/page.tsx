import { getSession } from "@/lib/session";
import { getMembers } from "@/lib/db";
import MyPageForm from "@/components/MyPageForm";
import PushToggle from "@/components/PushToggle";

export const dynamic = "force-dynamic";

export default async function MyPage() {
  const session = await getSession();
  const members = await getMembers();
  const me = members.find((m) => m.id === session?.id) ?? null;

  return (
    <>
      <div className="page-head">
        <h1>마이페이지</h1>
        <p>내 기본 정보를 확인하고 수정하세요.</p>
      </div>
      <MyPageForm session={session} member={me} />
      <div className="section-title">알림 설정</div>
      <PushToggle />
    </>
  );
}
