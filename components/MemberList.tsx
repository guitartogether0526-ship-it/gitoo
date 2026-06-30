"use client";

import { useState } from "react";
import type { Member, MemberRole } from "@/lib/types";
import { getSupabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth";
import { can, ROLE_LABEL, ROLE_ORDER } from "@/lib/roles";

const ROLE_BADGE: Record<MemberRole, string> = {
  president: "amber",
  treasurer: "amber",
  staff: "ok",
  member: "",
};

export default function MemberList({ initial }: { initial: Member[] }) {
  const { user } = useAuth();
  const canManage = can.manageMembers(user?.role);
  const [members, setMembers] = useState<Member[]>(initial);

  const setRole = (id: string, role: MemberRole) => {
    setMembers((prev) => prev.map((m) => (m.id === id ? { ...m, role } : m)));
    const sb = getSupabase();
    if (sb) void sb.from("members").update({ role }).eq("id", id);
  };

  return (
    <>
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
            {members.map((m) => (
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
                      onChange={(e) => setRole(m.id, e.target.value as MemberRole)}
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
      <p className="dim" style={{ fontSize: 12, textAlign: "center", marginTop: 10 }}>
        {canManage
          ? "STAFF 이상만 권한을 변경할 수 있어요 · 드롭다운으로 등급 선택 (좌우 스크롤)"
          : "권한 변경은 운영진(STAFF 이상) 전용입니다 (좌우 스크롤)"}
      </p>
    </>
  );
}
