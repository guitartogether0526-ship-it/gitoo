"use client";

import { useMemo } from "react";
import type { Member, Team } from "@/lib/types";
import { PARTS } from "@/lib/parts";

type CellMember = { id: string; name: string; resting: boolean };

/**
 * 승인 회원을 팀×파트로 그루핑한다.
 * 팀↔악기 페어링: 팀1 소속이면 악기1(part), 팀2 소속이면 악기2(part2, 없으면 part).
 * 두 팀에 속한 회원은 두 팀 컬럼에 각자 해당 악기로 등장한다.
 */
function groupByTeamPart(members: Member[], teams: Team[]) {
  const cell = new Map<string, CellMember[]>(); // key = `${teamId}|${part}`
  const extraParts = new Set<string>(); // PARTS 목록에 없는 파트 (part는 자유 텍스트)
  const unassigned: { id: string; name: string; part: string; resting: boolean }[] = [];

  const put = (teamId: string, rawPart: string, m: Member) => {
    const part = rawPart || "미입력";
    const key = `${teamId}|${part}`;
    const arr = cell.get(key) ?? [];
    arr.push({ id: m.id, name: m.name, resting: m.status === "rest" });
    cell.set(key, arr);
    if (!PARTS.includes(part)) extraParts.add(part);
  };

  for (const m of members) {
    if (!m.approved) continue;
    if (!m.team_id && !m.team_id_2) {
      unassigned.push({
        id: m.id,
        name: m.name,
        part: m.part || "미입력",
        resting: m.status === "rest",
      });
      continue;
    }
    if (m.team_id) put(m.team_id, m.part, m); // 팀1 = 악기1
    if (m.team_id_2 && m.team_id_2 !== m.team_id) put(m.team_id_2, m.part2 || m.part, m); // 팀2 = 악기2
  }
  for (const arr of cell.values()) arr.sort((a, b) => a.name.localeCompare(b.name, "ko"));
  unassigned.sort((a, b) => a.name.localeCompare(b.name, "ko"));

  // 행 = 실제 회원이 있는 파트(PARTS 순서 유지) + 비표준 파트(가나다순)
  const partRows = [
    ...PARTS.filter((p) => teams.some((t) => cell.has(`${t.id}|${p}`))),
    ...[...extraParts].sort((a, b) => a.localeCompare(b, "ko")),
  ];
  const get = (teamId: string, part: string) => cell.get(`${teamId}|${part}`) ?? [];
  return { partRows, get, unassigned };
}

/** 팀·파트별 회원표 팝업 — 회원목록의 "표로 보기" (읽기 전용) */
export default function MemberTableModal({
  members,
  teams,
  onClose,
}: {
  members: Member[];
  teams: Team[];
  onClose: () => void;
}) {
  const { partRows, get, unassigned } = useMemo(
    () => groupByTeamPart(members, teams),
    [members, teams],
  );
  // 팀 헤더의 인원수 — 두 팀 소속 회원은 각 팀에 1명씩 센다
  const teamCount = (teamId: string) =>
    members.filter((m) => m.approved && (m.team_id === teamId || m.team_id_2 === teamId)).length;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="card"
        style={{ margin: 0, width: "100%", maxWidth: 460, maxHeight: "85vh", overflowY: "auto" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="title-row">
          <div className="section-title" style={{ margin: 0 }}>
            팀·파트별 회원표
          </div>
          <button className="btn ghost btn-sm" onClick={onClose}>
            닫기
          </button>
        </div>

        {partRows.length === 0 ? (
          <p className="dim" style={{ fontSize: 13, marginBottom: 0 }}>
            아직 팀에 배정된 회원이 없습니다.
          </p>
        ) : (
          <div className="table-wrap" style={{ marginTop: 8 }}>
            <table className="mtable member-grid">
              <thead>
                <tr>
                  <th>파트</th>
                  {teams.map((t) => (
                    <th key={t.id}>
                      {t.name} ({teamCount(t.id)})
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {partRows.map((part) => (
                  <tr key={part}>
                    <th scope="row">{part}</th>
                    {teams.map((t) => {
                      const cellMembers = get(t.id, part);
                      return (
                        <td key={t.id}>
                          {cellMembers.length === 0 ? (
                            <span className="dim">—</span>
                          ) : (
                            cellMembers.map((m) => (
                              <span
                                key={m.id}
                                className={m.resting ? "dim" : undefined}
                                style={{ display: "block" }}
                              >
                                {m.name}
                                {m.resting && " (휴식)"}
                              </span>
                            ))
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {unassigned.length > 0 && (
          <p className="dim" style={{ fontSize: 12, marginTop: 8, marginBottom: 0 }}>
            미배정:{" "}
            {unassigned.map((m, i) => (
              <span key={m.id}>
                {i > 0 && " · "}
                {m.name}({m.part}){m.resting && " (휴식)"}
              </span>
            ))}
          </p>
        )}
      </div>
    </div>
  );
}
