import { getMembers, getTeams } from "@/lib/db";
import { PARTS } from "@/lib/parts";
import MemberList from "@/components/MemberList";

export const dynamic = "force-dynamic";

export default async function MembersPage() {
  const [members, teams] = await Promise.all([getMembers(), getTeams()]);
  const approved = members.filter((m) => m.approved);
  const pending = members.length - approved.length;
  const staff = approved.filter((m) => m.role !== "member").length;

  // 파트별 인원수 — 악기1·악기2 모두 집계(악기 2개인 회원은 양쪽에 포함). PARTS 순서, 그 외 파트는 뒤에.
  const partCounts = new Map<string, number>();
  for (const m of approved) {
    for (const p of [m.part, m.part2]) {
      if (p) partCounts.set(p, (partCounts.get(p) ?? 0) + 1);
    }
  }
  const partSummary = [...partCounts.entries()]
    .sort(([a], [b]) => {
      const ia = PARTS.indexOf(a);
      const ib = PARTS.indexOf(b);
      return (ia === -1 ? PARTS.length : ia) - (ib === -1 ? PARTS.length : ib);
    })
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
      <MemberList initial={members} teams={teams} />
    </>
  );
}
