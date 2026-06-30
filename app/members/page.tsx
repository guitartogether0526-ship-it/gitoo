import { getMembers, getTeams } from "@/lib/db";
import MemberList from "@/components/MemberList";

export const dynamic = "force-dynamic";

export default async function MembersPage() {
  const [members, teams] = await Promise.all([getMembers(), getTeams()]);
  const approved = members.filter((m) => m.approved);
  const pending = members.length - approved.length;
  const staff = approved.filter((m) => m.role !== "member").length;

  return (
    <>
      <div className="page-head">
        <h1>회원 / 관리자</h1>
        <p>
          회원 {approved.length}명 · 운영진 {staff}명
          {pending > 0 ? ` · 승인 대기 ${pending}명` : ""}
        </p>
      </div>
      <MemberList initial={members} teams={teams} />
    </>
  );
}
