"use client";

import { useState } from "react";
import type { Member } from "@/lib/types";
import { getSupabase } from "@/lib/supabase";

export default function MemberList({ initial }: { initial: Member[] }) {
  const [members, setMembers] = useState<Member[]>(initial);

  const toggle = (id: string, key: "is_staff" | "is_treasurer") => {
    let next = false;
    setMembers((prev) =>
      prev.map((m) => {
        if (m.id !== id) return m;
        next = !m[key];
        return { ...m, [key]: next };
      }),
    );
    const sb = getSupabase();
    if (sb) void sb.from("members").update({ [key]: next }).eq("id", id);
  };

  return (
    <>
      <div className="table-wrap">
        <table className="mtable">
          <thead>
            <tr>
              <th>이름</th>
              <th>파트</th>
              <th className="role-cell">운영진</th>
              <th className="role-cell">총무</th>
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
                  <button
                    className={`switch sm${m.is_staff ? " on" : ""}`}
                    role="switch"
                    aria-checked={m.is_staff}
                    aria-label={`${m.name} 운영진 권한`}
                    onClick={() => toggle(m.id, "is_staff")}
                  />
                </td>
                <td className="role-cell">
                  <button
                    className={`switch sm${m.is_treasurer ? " on" : ""}`}
                    role="switch"
                    aria-checked={m.is_treasurer}
                    aria-label={`${m.name} 총무 권한`}
                    onClick={() => toggle(m.id, "is_treasurer")}
                  />
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
        운영진 전용 화면 · 앰버 토글로 권한을 변경하세요 (좌우 스크롤)
      </p>
    </>
  );
}
