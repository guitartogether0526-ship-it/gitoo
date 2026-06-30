"use client";

import { useState } from "react";
import type { Member, MemberRole } from "@/lib/types";
import { useAuth } from "@/lib/auth";
import { can, ROLE_LABEL, ROLE_ORDER } from "@/lib/roles";
import { approveMember, rejectMember, changeRole } from "@/lib/auth-actions";

const ROLE_BADGE: Record<MemberRole, string> = {
  admin: "amber",
  president: "amber",
  treasurer: "amber",
  staff: "ok",
  member: "",
};

export default function MemberList({ initial }: { initial: Member[] }) {
  const { user } = useAuth();
  const canManage = can.manageMembers(user?.role);
  const [members, setMembers] = useState<Member[]>(initial);
  const [busy, setBusy] = useState<string>("");

  const pending = members.filter((m) => !m.approved);
  const approved = members.filter((m) => m.approved);

  const onApprove = async (id: string) => {
    setBusy(id);
    const res = await approveMember(id);
    setBusy("");
    if ("ok" in res) setMembers((prev) => prev.map((m) => (m.id === id ? { ...m, approved: true } : m)));
    else alert(res.error);
  };

  const onReject = async (id: string) => {
    setBusy(id);
    const res = await rejectMember(id);
    setBusy("");
    if ("ok" in res) setMembers((prev) => prev.filter((m) => m.id !== id));
    else alert(res.error);
  };

  const onRole = async (id: string, role: MemberRole) => {
    const prevRole = members.find((m) => m.id === id)?.role;
    setMembers((prev) => prev.map((m) => (m.id === id ? { ...m, role } : m)));
    const res = await changeRole(id, role);
    if ("error" in res) {
      // 롤백
      setMembers((prev) => prev.map((m) => (m.id === id ? { ...m, role: prevRole ?? "member" } : m)));
      alert(res.error);
    }
  };

  return (
    <>
      {/* 가입 승인 대기 */}
      {canManage && pending.length > 0 && (
        <>
          <div className="section-title">🕓 가입 승인 대기 ({pending.length})</div>
          {pending.map((m) => (
            <div className="card" key={m.id}>
              <div className="title-row">
                <div className="grow">
                  <span className="m-name">{m.name}</span>
                  <span className="m-cohort">{m.cohort}기 · {m.part}</span>
                  <div className="dim" style={{ fontSize: 12, marginTop: 2 }}>아이디: {m.username}</div>
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
      <div className="section-title">👥 회원 목록 ({approved.length})</div>
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
                <th className="role-cell">권한</th>
                <th>상태</th>
              </tr>
            </thead>
            <tbody>
              {approved.map((m) => (
                <tr key={m.id}>
                  <td>
                    <span className="m-name">{m.name}</span>
                    <span className="m-cohort">{m.cohort}기</span>
                  </td>
                  <td>{m.part}</td>
                  <td className="role-cell">
                    {canManage ? (
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
                    ) : (
                      <span className={`badge ${ROLE_BADGE[m.role]}`}>{ROLE_LABEL[m.role]}</span>
                    )}
                  </td>
                  <td>
                    <span className={`badge ${m.status === "active" ? "ok" : ""}`}>
                      {m.status === "active" ? "활동중" : "휴식"}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <p className="dim" style={{ fontSize: 12, textAlign: "center", marginTop: 10 }}>
        {canManage
          ? "STAFF 이상만 가입 승인·권한 변경이 가능합니다 (좌우 스크롤)"
          : "가입 승인·권한 변경은 운영진(STAFF 이상) 전용입니다 (좌우 스크롤)"}
      </p>
    </>
  );
}
