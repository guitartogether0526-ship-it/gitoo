"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { Member, MemberRole, MemberStatus, Team } from "@/lib/types";
import { useAuth } from "@/lib/auth";
import { can, ROLE_LABEL, ROLE_ORDER } from "@/lib/roles";
import {
  approveMember,
  rejectMember,
  changeRole,
  changeTeam,
  changeStatus,
  kickMember,
} from "@/lib/auth-actions";

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

  const onTeam = async (id: string, teamId: string | null) => {
    const prevTeam = members.find((m) => m.id === id)?.team_id ?? null;
    setMembers((prev) => prev.map((m) => (m.id === id ? { ...m, team_id: teamId } : m)));
    const res = await changeTeam(id, teamId);
    if ("error" in res) {
      setMembers((prev) => prev.map((m) => (m.id === id ? { ...m, team_id: prevTeam } : m)));
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
                  <span className="m-cohort">{m.part}</span>
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
                <th>이름</th>
                <th>파트</th>
                <th className="role-cell">팀</th>
                <th className="role-cell">권한</th>
                <th className="role-cell">상태</th>
                <th>관리</th>
              </tr>
            </thead>
            <tbody>
              {approved.map((m) => (
                <tr key={m.id}>
                  <td>
                    <span className="m-name">{m.name}</span>
                    <span className="dim" style={{ display: "block", fontSize: 11, marginTop: 2 }}>
                      {m.username}
                    </span>
                  </td>
                  <td>{m.part}</td>
                  <td className="role-cell">
                    <select
                      className="select sm"
                      value={m.team_id ?? ""}
                      onChange={(e) => onTeam(m.id, e.target.value || null)}
                      aria-label={`${m.name} 팀 배정`}
                    >
                      <option value="">미배정</option>
                      {teams.map((t) => (
                        <option key={t.id} value={t.id}>
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
        팀·권한·상태 변경과 강퇴(계정 삭제)는 운영진(STAFF 이상) 전용입니다. (좌우 스크롤)
      </p>
    </>
  );
}
