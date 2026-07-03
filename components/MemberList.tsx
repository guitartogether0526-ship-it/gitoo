"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { Member, MemberRole, MemberStatus, Team } from "@/lib/types";
import { useAuth } from "@/lib/auth";
import { can, ROLE_LABEL, ROLE_ORDER } from "@/lib/roles";
import { partLabel, PARTS } from "@/lib/parts";
import {
  approveMember,
  rejectMember,
  changeRole,
  changeTeam,
  changeStatus,
  kickMember,
} from "@/lib/auth-actions";

type SortKey = "name" | "part" | "team1" | "team2" | "role" | "status";

/** 정렬 가능한 테이블 헤더 — 클릭 시 오름차순 ↔ 내림차순 토글 */
function SortTh({
  label,
  k,
  sortKey,
  dir,
  onSort,
  className,
}: {
  label: string;
  k: SortKey;
  sortKey: SortKey | null;
  dir: 1 | -1;
  onSort: (k: SortKey) => void;
  className?: string;
}) {
  const active = sortKey === k;
  return (
    <th className={className} aria-sort={active ? (dir === 1 ? "ascending" : "descending") : undefined}>
      <button
        type="button"
        onClick={() => onSort(k)}
        style={{
          background: "none",
          border: 0,
          padding: 0,
          font: "inherit",
          color: "inherit",
          cursor: "pointer",
          display: "inline-flex",
          alignItems: "center",
          gap: 2,
        }}
      >
        {label}
        <svg
          width="10"
          height="10"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
          style={{ opacity: active ? 0.9 : 0.3, flexShrink: 0 }}
        >
          {active && dir === -1 ? <path d="M6 10l6 6 6-6" /> : <path d="M6 14l6-6 6 6" />}
        </svg>
      </button>
    </th>
  );
}

export default function MemberList({ initial, teams }: { initial: Member[]; teams: Team[] }) {
  const { user } = useAuth();
  const router = useRouter();
  const canManage = can.manageMembers(user?.role);
  const [members, setMembers] = useState<Member[]>(initial);
  const [busy, setBusy] = useState<string>("");
  // 새 가입 신청 등 서버 최신 데이터를 화면에 반영 (LiveRefresh/새로고침 시)
  useEffect(() => setMembers(initial), [initial]);

  const pending = members.filter((m) => !m.approved);
  const approved = members.filter((m) => m.approved);

  // 컬럼별 정렬 (헤더 클릭 — 같은 헤더 재클릭 시 방향 토글)
  const [sortKey, setSortKey] = useState<SortKey | null>(null);
  const [sortDir, setSortDir] = useState<1 | -1>(1);
  const onSort = (k: SortKey) => {
    if (sortKey === k) setSortDir((d) => (d === 1 ? -1 : 1));
    else {
      setSortKey(k);
      setSortDir(1);
    }
  };

  // 미배정("")은 오름차순에서 맨 뒤로 가도록 가장 큰 문자로 치환
  const teamName = (id: string | null) => teams.find((t) => t.id === id)?.name ?? "￿";
  // 파트는 PARTS 순서(기타→베이스→…), 목록에 없는 파트는 뒤로
  const partRank = (p: string) => {
    const i = PARTS.indexOf(p);
    return i === -1 ? PARTS.length : i;
  };
  const sorted = sortKey
    ? [...approved].sort((a, b) => {
        let d = 0;
        switch (sortKey) {
          case "name":
            d = a.name.localeCompare(b.name, "ko");
            break;
          case "part":
            d = partRank(a.part) - partRank(b.part);
            break;
          case "team1":
            d = teamName(a.team_id).localeCompare(teamName(b.team_id), "ko");
            break;
          case "team2":
            d = teamName(a.team_id_2).localeCompare(teamName(b.team_id_2), "ko");
            break;
          case "role":
            d = ROLE_ORDER.indexOf(a.role) - ROLE_ORDER.indexOf(b.role);
            break;
          case "status":
            d = (a.status === "rest" ? 1 : 0) - (b.status === "rest" ? 1 : 0);
            break;
        }
        // 같은 값이면 이름순 (2차 정렬)
        return d * sortDir || a.name.localeCompare(b.name, "ko");
      })
    : approved;

  const onApprove = async (id: string) => {
    setBusy(id);
    const res = await approveMember(id);
    setBusy("");
    if ("ok" in res) {
      setMembers((prev) => prev.map((m) => (m.id === id ? { ...m, approved: true } : m)));
      router.refresh();
    } else alert(res.error);
  };

  const onReject = async (id: string) => {
    setBusy(id);
    const res = await rejectMember(id);
    setBusy("");
    if ("ok" in res) {
      setMembers((prev) => prev.filter((m) => m.id !== id));
      router.refresh();
    } else alert(res.error);
  };

  const onTeam = async (id: string, teamId: string | null, slot: 1 | 2) => {
    const key = slot === 2 ? "team_id_2" : "team_id";
    const prevVal = members.find((m) => m.id === id)?.[key] ?? null;
    setMembers((prev) => prev.map((m) => (m.id === id ? { ...m, [key]: teamId } : m)));
    const res = await changeTeam(id, teamId, slot);
    if ("error" in res) {
      setMembers((prev) => prev.map((m) => (m.id === id ? { ...m, [key]: prevVal } : m)));
      alert(res.error);
    }
  };

  const onRole = async (id: string, role: MemberRole) => {
    const prevRole = members.find((m) => m.id === id)?.role;
    setMembers((prev) => prev.map((m) => (m.id === id ? { ...m, role } : m)));
    const res = await changeRole(id, role);
    if ("error" in res) {
      setMembers((prev) => prev.map((m) => (m.id === id ? { ...m, role: prevRole ?? "member" } : m)));
      alert(res.error);
    }
  };

  const onStatus = async (id: string, status: MemberStatus) => {
    const prevStatus = members.find((m) => m.id === id)?.status;
    setMembers((prev) => prev.map((m) => (m.id === id ? { ...m, status } : m)));
    const res = await changeStatus(id, status);
    if ("error" in res) {
      setMembers((prev) => prev.map((m) => (m.id === id ? { ...m, status: prevStatus ?? "active" } : m)));
      alert(res.error);
    }
  };

  const onKick = async (m: Member) => {
    if (!window.confirm(`${m.name} 님을 강퇴(계정 삭제)할까요?\n같은 아이디로 재가입은 가능합니다.`)) return;
    setBusy(m.id);
    const res = await kickMember(m.id);
    setBusy("");
    if ("ok" in res) {
      setMembers((prev) => prev.filter((x) => x.id !== m.id));
      router.refresh();
    } else alert(res.error);
  };

  // 회원 목록은 운영진(관리자·회장·총무·STAFF)만 열람
  if (!canManage) {
    return (
      <div className="card">
        <p className="dim" style={{ margin: 0, fontSize: 13 }}>
          회원 목록은 운영진(관리자·회장·총무·STAFF)만 볼 수 있습니다.
        </p>
      </div>
    );
  }

  return (
    <>
      {/* 가입 승인 대기 */}
      {pending.length > 0 && (
        <>
          <div className="section-title">가입 승인 대기 ({pending.length})</div>
          {pending.map((m) => (
            <div className="card" key={m.id}>
              <div className="title-row">
                <div className="grow">
                  <span className="m-name">{m.name}</span>
                  <span className="m-cohort">{partLabel(m.part, m.part2)}</span>
                  <div className="dim" style={{ fontSize: 12, marginTop: 2 }}>
                    아이디: {m.username} · {m.phone} · {m.email}
                  </div>
                </div>
              </div>
              <div className="btn-row">
                <button className="btn amber btn-sm" disabled={busy === m.id} onClick={() => onApprove(m.id)}>
                  승인
                </button>
                <button className="btn danger btn-sm" disabled={busy === m.id} onClick={() => onReject(m.id)}>
                  거절
                </button>
              </div>
            </div>
          ))}
        </>
      )}

      {/* 회원 목록 */}
      <div className="section-title">회원 목록 ({approved.length})</div>
      {approved.length === 0 ? (
        <div className="card">
          <p className="dim" style={{ margin: 0, fontSize: 13 }}>아직 승인된 회원이 없습니다.</p>
        </div>
      ) : (
        <div className="table-wrap">
          <table className="mtable">
            <thead>
              <tr>
                <SortTh label="이름" k="name" sortKey={sortKey} dir={sortDir} onSort={onSort} />
                <SortTh label="파트" k="part" sortKey={sortKey} dir={sortDir} onSort={onSort} />
                <SortTh label="팀1" k="team1" sortKey={sortKey} dir={sortDir} onSort={onSort} className="role-cell" />
                <SortTh label="팀2" k="team2" sortKey={sortKey} dir={sortDir} onSort={onSort} className="role-cell" />
                <SortTh label="권한" k="role" sortKey={sortKey} dir={sortDir} onSort={onSort} className="role-cell" />
                <SortTh label="상태" k="status" sortKey={sortKey} dir={sortDir} onSort={onSort} className="role-cell" />
                <th>관리</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((m) => (
                <tr key={m.id}>
                  <td>
                    <span className="m-name">{m.name}</span>
                    <span className="dim" style={{ display: "block", fontSize: 11, marginTop: 2 }}>
                      {m.username}
                    </span>
                  </td>
                  <td>{partLabel(m.part, m.part2)}</td>
                  <td className="role-cell">
                    <select
                      className="select sm"
                      value={m.team_id ?? ""}
                      onChange={(e) => onTeam(m.id, e.target.value || null, 1)}
                      aria-label={`${m.name} 팀1 배정`}
                    >
                      <option value="">미배정</option>
                      {teams.map((t) => (
                        <option key={t.id} value={t.id} disabled={t.id === m.team_id_2}>
                          {t.name}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="role-cell">
                    <select
                      className="select sm"
                      value={m.team_id_2 ?? ""}
                      onChange={(e) => onTeam(m.id, e.target.value || null, 2)}
                      aria-label={`${m.name} 팀2 배정`}
                    >
                      <option value="">없음</option>
                      {teams.map((t) => (
                        <option key={t.id} value={t.id} disabled={t.id === m.team_id}>
                          {t.name}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="role-cell">
                    <select
                      className="select sm"
                      value={m.role}
                      onChange={(e) => onRole(m.id, e.target.value as MemberRole)}
                      aria-label={`${m.name} 권한 변경`}
                    >
                      {ROLE_ORDER.map((r) => (
                        <option key={r} value={r}>
                          {ROLE_LABEL[r]}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="role-cell">
                    <select
                      className="select sm"
                      value={m.status}
                      onChange={(e) => onStatus(m.id, e.target.value as MemberStatus)}
                      aria-label={`${m.name} 상태 변경`}
                    >
                      <option value="active">활동중</option>
                      <option value="rest">휴식</option>
                    </select>
                  </td>
                  <td>
                    <button
                      className="btn danger btn-sm"
                      disabled={busy === m.id}
                      onClick={() => onKick(m)}
                      title="계정 삭제 (재가입 가능)"
                    >
                      강퇴
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <p className="dim" style={{ fontSize: 12, textAlign: "center", marginTop: 10 }}>
        표 제목을 누르면 해당 항목으로 정렬됩니다(재클릭 시 역순). 팀1·팀2(두 팀 참여 가능)·권한·상태 변경과 강퇴(계정 삭제)는 운영진(STAFF 이상) 전용입니다. (좌우 스크롤)
      </p>
    </>
  );
}
