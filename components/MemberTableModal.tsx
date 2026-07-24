"use client";

import { useMemo } from "react";
import type { Member, Team } from "@/lib/types";
import { PARTS } from "@/lib/parts";
import { kstYmd } from "@/lib/date";

type CellMember = { id: string; name: string; resting: boolean };

// 기타는 팀당 2자리 고정 — 빈 자리는 null("—"로 표시), 인원이 넘치면 그만큼 늘어남
const guitarSlots = (cell: CellMember[]): (CellMember | null)[] =>
  [...cell, null, null].slice(0, Math.max(2, cell.length));

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

  // 행 = 표준 파트 전부(인원 없어도 표시, 보컬 맨 위) + 비표준 파트(가나다순)
  const partRows = [
    "보컬",
    ...PARTS.filter((p) => p !== "보컬"),
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

  // 표를 캔버스에 그려 PNG로 저장 (다크 테마 색상은 CSS 토큰에서 가져옴)
  const downloadImage = () => {
    const css = getComputedStyle(document.documentElement);
    const cv = (name: string, fallback: string) => css.getPropertyValue(name).trim() || fallback;
    const color = {
      bg: cv("--surface", "#1c1714"),
      border: cv("--border-strong", "#3a322c"),
      text: cv("--text", "#f2ece6"),
      dim: cv("--text-dim", "#8d8178"),
      accent: cv("--accent", "#f0a856"),
    };
    const FONT = '"Noto Sans KR", sans-serif';

    // 레이아웃(논리 px) — 셀 높이는 그 행에서 인원이 가장 많은 칸 기준
    const M = 16; // 바깥 여백
    const LINE = 24; // 일반 행의 이름 한 명당 세로 공간
    const SLOT = 42; // 기타 자리(팀당 2자리) 높이 — 좁으면 이름·격자선이 붙어 보임
    const PAD = 8;
    const TITLE_H = 34;
    const HEAD_H = 34;
    const partColW = 64;
    const teamColW = 104;
    const tableW = partColW + teams.length * teamColW;
    const rowHs = partRows.map((part) => {
      if (part === "기타") {
        // 기타 행 = 자리(최소 2개) × 자리 높이, 자리 경계가 곧 격자선
        const slotCount = Math.max(2, ...teams.map((t) => get(t.id, part).length));
        return slotCount * SLOT;
      }
      const maxLen = Math.max(1, ...teams.map((t) => get(t.id, part).length));
      return maxLen * LINE + PAD * 2;
    });
    const tableH = HEAD_H + rowHs.reduce((s, h) => s + h, 0);
    // 미배정은 표 아래 줄바꿈 텍스트로
    const unassignedText =
      unassigned.length > 0
        ? "미배정: " + unassigned.map((m) => `${m.name}(${m.part})${m.resting ? " (휴식)" : ""}`).join(" · ")
        : "";
    const W = tableW + M * 2;

    const S = 2; // 해상도 배율
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // 미배정 텍스트 줄바꿈 계산 (폭 측정용으로 폰트 먼저 지정)
    ctx.font = `12px ${FONT}`;
    const unassignedLines: string[] = [];
    if (unassignedText) {
      let cur = "";
      for (const word of unassignedText.split(" ")) {
        const next = cur ? `${cur} ${word}` : word;
        if (ctx.measureText(next).width > tableW && cur) {
          unassignedLines.push(cur);
          cur = word;
        } else cur = next;
      }
      if (cur) unassignedLines.push(cur);
    }
    const H = M + TITLE_H + tableH + (unassignedLines.length ? 10 + unassignedLines.length * 18 : 0) + M;

    canvas.width = W * S;
    canvas.height = H * S;
    ctx.scale(S, S);

    // 배경 + 제목
    ctx.fillStyle = color.bg;
    ctx.fillRect(0, 0, W, H);
    ctx.textBaseline = "middle";
    ctx.fillStyle = color.accent;
    ctx.font = `700 15px ${FONT}`;
    ctx.textAlign = "left";
    ctx.fillText(`팀·파트별 회원표  ·  ${kstYmd()}`, M, M + TITLE_H / 2 - 4);

    const top = M + TITLE_H;
    const colX = (i: number) => M + partColW + i * teamColW; // i번째 팀 컬럼의 왼쪽 x

    // 헤더 행
    ctx.textAlign = "center";
    ctx.font = `700 13px ${FONT}`;
    ctx.fillStyle = color.text;
    ctx.fillText("파트", M + partColW / 2, top + HEAD_H / 2);
    teams.forEach((t, i) => {
      ctx.fillText(`${t.name} (${teamCount(t.id)}명)`, colX(i) + teamColW / 2, top + HEAD_H / 2);
    });

    // 셀 내용
    let y = top + HEAD_H;
    partRows.forEach((part, r) => {
      ctx.font = `700 13px ${FONT}`;
      ctx.fillStyle = color.text;
      ctx.fillText(part, M + partColW / 2, y + rowHs[r] / 2);
      teams.forEach((t, i) => {
        const cell = get(t.id, part);
        const slots: (CellMember | null)[] = part === "기타" ? guitarSlots(cell) : cell;
        if (slots.length === 0) {
          ctx.fillStyle = color.dim;
          ctx.font = `13px ${FONT}`;
          ctx.fillText("—", colX(i) + teamColW / 2, y + rowHs[r] / 2);
          return;
        }
        // 기타는 자리 높이(SLOT) 기준 중앙, 일반 행은 줄 간격(LINE) 기준
        const slotH = part === "기타" ? SLOT : LINE;
        const offset = part === "기타" ? 0 : PAD;
        slots.forEach((m, k) => {
          if (part === "기타" && k > 0) {
            // 표 격자선과 같은 색으로 칸 전체 폭 분할선 (자리 경계)
            ctx.strokeStyle = color.border;
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(colX(i), y + k * SLOT);
            ctx.lineTo(colX(i) + teamColW, y + k * SLOT);
            ctx.stroke();
          }
          ctx.fillStyle = !m || m.resting ? color.dim : color.text;
          ctx.font = `13px ${FONT}`;
          ctx.fillText(
            m ? (m.resting ? `${m.name} (휴식)` : m.name) : "—",
            colX(i) + teamColW / 2,
            y + offset + k * slotH + slotH / 2,
          );
        });
      });
      y += rowHs[r];
    });

    // 격자선
    ctx.strokeStyle = color.border;
    ctx.lineWidth = 1;
    const line = (x1: number, y1: number, x2: number, y2: number) => {
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.stroke();
    };
    let gy = top;
    line(M, gy, M + tableW, gy);
    gy += HEAD_H;
    line(M, gy, M + tableW, gy);
    rowHs.forEach((h) => {
      gy += h;
      line(M, gy, M + tableW, gy);
    });
    line(M, top, M, gy); // 왼쪽 세로 테두리
    for (let i = 0; i <= teams.length; i++) {
      const x = M + partColW + i * teamColW;
      line(x, top, x, gy);
    }

    // 미배정
    if (unassignedLines.length) {
      ctx.textAlign = "left";
      ctx.fillStyle = color.dim;
      ctx.font = `12px ${FONT}`;
      unassignedLines.forEach((l, i) => ctx.fillText(l, M, gy + 10 + i * 18 + 9));
    }

    canvas.toBlob((blob) => {
      if (!blob) return;
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `회원표_${kstYmd()}.png`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 5000);
    }, "image/png");
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="card"
        style={{ margin: 0, width: "100%", maxWidth: 460, maxHeight: "85vh", overflowY: "auto" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="title-row" style={{ alignItems: "center" }}>
          <div className="section-title grow" style={{ margin: 0 }}>
            팀·파트별 회원표
          </div>
          <button
            className="btn ghost btn-sm"
            onClick={downloadImage}
            style={{ display: "inline-flex", alignItems: "center", gap: 5 }}
          >
              <svg
                width="12"
                height="12"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.2"
                strokeLinecap="round"
                strokeLinejoin="round"
                style={{ flexShrink: 0 }}
              >
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <path d="M7 10l5 5 5-5" />
                <path d="M12 15V3" />
              </svg>
            이미지 저장
          </button>
          <button className="btn ghost btn-sm" onClick={onClose}>
            닫기
          </button>
        </div>

        {/* partRows는 표준 PARTS를 항상 포함해 비지 않는다 */}
        <div className="table-wrap" style={{ marginTop: 8 }}>
            <table className="mtable member-grid">
              <thead>
                <tr>
                  <th>파트</th>
                  {teams.map((t) => (
                    <th key={t.id}>
                      {t.name} ({teamCount(t.id)}명)
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
                      const slots: (CellMember | null)[] =
                        part === "기타" ? guitarSlots(cellMembers) : cellMembers;
                      return (
                        <td key={t.id}>
                          {slots.length === 0 ? (
                            <span className="dim">—</span>
                          ) : (
                            slots.map((m, k) => (
                              <span
                                key={m ? m.id : `empty-${k}`}
                                className={!m || m.resting ? "dim" : undefined}
                                style={{
                                  // 자리마다 같은 높이의 박스 — 이름을 박스 정중앙에
                                  display: "flex",
                                  alignItems: "center",
                                  justifyContent: "center",
                                  minHeight: 44,
                                  // 표 격자선과 같은 스타일로 칸을 행처럼 분할 (셀 가로 패딩 10px 상쇄)
                                  ...(part === "기타" && k > 0
                                    ? {
                                        borderTop: "1px solid var(--border)",
                                        margin: "0 -10px",
                                        padding: "0 10px",
                                      }
                                    : {}),
                                }}
                              >
                                {m ? (m.resting ? `${m.name} (휴식)` : m.name) : "—"}
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
