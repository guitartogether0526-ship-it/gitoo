"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  type Member,
  type MemberRole,
  type MemberStatus,
  type Team,
  TEAM_CATEGORIES,
  teamCategory,
} from "@/lib/types";
import { useAuth } from "@/lib/auth";
import { can, ROLE_LABEL, ROLE_ORDER } from "@/lib/roles";
import { partLabel, partRank } from "@/lib/parts";
import { useSyncedState } from "@/lib/use-synced-state";
import { useRefreshHold } from "@/lib/refresh-hold";
import MemberTableModal from "@/components/MemberTableModal";
import {
  approveMember,
  rejectMember,
  changeRole,
  changeTeam,
  changeStatus,
  kickMember,
} from "@/lib/auth-actions";

// 팀 슬롯 1~3 — 회원 한 명이 최대 3개 팀에 소속될 수 있다
const TEAM_SLOTS = [1, 2, 3] as const;
const TEAM_COL = { 1: "team_id", 2: "team_id_2", 3: "team_id_3" } as const;

type SortKey = "name" | "part" | "team1" | "team2" | "team3" | "role" | "status";

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
  // 새 가입 신청 등 서버 최신 데이터를 반영하되, 내용이 같으면 리렌더 없음 (LiveRefresh/새로고침 시)
  const [members, setMembers] = useSyncedState<Member[]>(initial);
  const [busy, setBusy] = useState<string>("");
  // 팀·파트별 회원표 팝업 — 열려 있는 동안 자동 동기화 보류 (닫으면 다음 주기에 재개)
  const [showTable, setShowTable] = useState(false);
  useRefreshHold(showTable);

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
          case "team3":
            d = teamName(a.team_id_3).localeCompare(teamName(b.team_id_3), "ko");
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

  // 낙관적 갱신 공통 — 필드 패치 → 서버 액션 → 실패 시 원복 + 알림
  const patchField = async <K extends keyof Member>(
    id: string,
    key: K,
    value: Member[K],
    action: () => Promise<{ ok: true } | { error: string }>,
  ) => {
    const prevVal = members.find((m) => m.id === id)?.[key];
    setMembers((prev) => prev.map((m) => (m.id === id ? ({ ...m, [key]: value } as Member) : m)));
    const res = await action();
    if ("error" in res) {
      setMembers((prev) => prev.map((m) => (m.id === id ? ({ ...m, [key]: prevVal } as Member) : m)));
      alert(res.error);
    }
  };

  const onTeam = (id: string, teamId: string | null, slot: 1 | 2 | 3) =>
    patchField(id, TEAM_COL[slot], teamId, () => changeTeam(id, teamId, slot));
  const onRole = (id: string, role: MemberRole) =>
    patchField(id, "role", role, () => changeRole(id, role));
  const onStatus = (id: string, status: MemberStatus) =>
    patchField(id, "status", status, () => changeStatus(id, status));

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
                  <span className="m-cohort">{partLabel(m.part, m.part2, m.part3)}</span>
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
      <div
        className="section-title"
        style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}
      >
        <span>회원 목록 ({approved.length})</span>
        <button className="btn ghost btn-sm" onClick={() => setShowTable(true)}>
          표로 보기
        </button>
      </div>
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
                <SortTh label="팀3" k="team3" sortKey={sortKey} dir={sortDir} onSort={onSort} className="role-cell" />
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
                  <td>{partLabel(m.part, m.part2, m.part3)}</td>
                  {TEAM_SLOTS.map((slot) => (
                    <td className="role-cell" key={slot}>
                      <select
                        className="select sm"
                        value={m[TEAM_COL[slot]] ?? ""}
                        onChange={(e) => onTeam(m.id, e.target.value || null, slot)}
                        aria-label={`${m.name} 팀${slot} 배정`}
                      >
                        <option value="">{slot === 1 ? "미배정" : "없음"}</option>
                        {/* 정기공연·재롱페스티벌 팀이 섞이지 않도록 페이지별로 묶는다 */}
                        {TEAM_CATEGORIES.map((c) => {
                          const catTeams = teams.filter((t) => teamCategory(t) === c);
                          if (catTeams.length === 0) return null;
                          return (
                            <optgroup key={c} label={c}>
                              {catTeams.map((t) => (
                                <option
                                  key={t.id}
                                  value={t.id}
                                  /* 다른 슬롯에 이미 배정된 팀은 선택 불가 (한 팀에 한 번만) */
                                  disabled={TEAM_SLOTS.some(
                                    (o) => o !== slot && m[TEAM_COL[o]] === t.id,
                                  )}
                                >
                                  {t.name}
                                </option>
                              ))}
                            </optgroup>
                          );
                        })}
                      </select>
                    </td>
                  ))}
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
        표 제목을 누르면 해당 항목으로 정렬됩니다(재클릭 시 역순). 팀1~팀3(최대 3개 팀 참여 가능)·권한·상태 변경과 강퇴(계정 삭제)는 운영진(STAFF 이상) 전용입니다. (좌우 스크롤)
      </p>

      {/* 팀·파트별 회원표 팝업 */}
      {showTable && (
        <MemberTableModal members={members} teams={teams} onClose={() => setShowTable(false)} />
      )}
    </>
  );
}
