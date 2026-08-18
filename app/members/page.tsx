import { getMembers, getTeams } from "@/lib/db";
import { getSession } from "@/lib/session";
import { can } from "@/lib/roles";
import { PARTS, partRank } from "@/lib/parts";
import MemberList from "@/components/MemberList";

export const dynamic = "force-dynamic";

export default async function MembersPage() {
  const [session, members, teams] = await Promise.all([getSession(), getMembers(), getTeams()]);
  const approved = members.filter((m) => m.approved);
  const pending = members.length - approved.length;
  const staff = approved.filter((m) => m.role !== "member").length;

  // 파트별 인원수 — 악기1~3 모두 집계(여러 악기인 회원은 각각 포함). PARTS 순서, 그 외 파트는 뒤에.
  const partCounts = new Map<string, number>();
  for (const m of approved) {
    for (const p of [m.part, m.part2, m.part3]) {
      if (p) partCounts.set(p, (partCounts.get(p) ?? 0) + 1);
    }
  }
  const partSummary = [...partCounts.entries()]
    .sort(([a], [b]) => partRank(a) - partRank(b))
    .map(([p, n]) => `${p} ${n}`)
    .join(" · ");

  return (
    <>
      <div className="page-head">
        <h1>회원 / 관리자</h1>
        <p>
          회원 {approved.length}명 · 운영진 {staff}명
          {pending > 0 ? ` · 승인 대기 ${pending}명` : ""}
          {partSummary && (
            <span style={{ display: "block", marginTop: 2 }}>{partSummary}</span>
          )}
        </p>
      </div>
      {/* 명단(이름·연락처 포함)은 운영진에게만 전달 — 클라이언트 렌더 가드만으로는
          RSC 페이로드(페이지 소스)에 전체 개인정보가 실려 나간다 */}
      <MemberList initial={can.manageMembers(session?.role) ? members : []} teams={teams} />
    </>
  );
}
