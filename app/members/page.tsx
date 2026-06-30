import { getMembers } from "@/lib/db";
import MemberList from "@/components/MemberList";

export default async function MembersPage() {
  const members = await getMembers();
  const staff = members.filter((m) => m.is_staff).length;

  return (
    <>
      <div className="page-head">
        <h1>회원 / 관리자</h1>
        <p>전체 {members.length}명 · 운영진 {staff}명 · 권한 토글로 관리</p>
      </div>
      <MemberList initial={members} />
    </>
  );
}
