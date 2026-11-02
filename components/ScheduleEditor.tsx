"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { ScheduleRow } from "@/lib/db";
import { saveSchedule } from "@/lib/schedule-actions";
import { useRefreshHold } from "@/lib/refresh-hold";

const MAX_ROWS = 8;
const FONT = '"Noto Sans KR", sans-serif';

/** 해당 월의 토요일을 "M월 D일"로 — 정기모임 기본 일시 */
function saturdaysOf(ym: string): string[] {
  const [y, m] = ym.split("-").map(Number);
  const out: string[] = [];
  for (let d = 1; d <= 31; d++) {
    const dt = new Date(Date.UTC(y, m - 1, d));
    if (dt.getUTCMonth() !== m - 1) break;
    if (dt.getUTCDay() === 6) out.push(`${m}월 ${d}일`);
  }
  return out;
}

const shiftYm = (ym: string, delta: number) => {
  const [y, m] = ym.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1 + delta, 1));
  return `${dt.getUTCFullYear()}-${String(dt.getUTCMonth() + 1).padStart(2, "0")}`;
};

/** 캔버스 글자 줄바꿈 — 폭을 넘으면 글자 단위로 자른다(한글은 띄어쓰기가 드물다) */
function wrap(ctx: CanvasRenderingContext2D, text: string, maxW: number): string[] {
  const lines: string[] = [];
  for (const para of text.split("\n")) {
    let cur = "";
    for (const ch of para) {
      if (ctx.measureText(cur + ch).width > maxW && cur) {
        lines.push(cur);
        cur = ch;
      } else cur += ch;
    }
    lines.push(cur);
  }
  return lines;
}

/** 공지용 이미지 — 참고 이미지와 같은 흰 배경·파란 머리글 표 */
function drawPng(ym: string, rows: ScheduleRow[]) {
  const [y, m] = ym.split("-").map(Number);
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  const S = 2;
  const W = 480;
  const M = 16;
  const COLS = [90, 130, W - M * 2 - 220]; // 일시 · 주제 · 내용
  const tableW = COLS.reduce((a, b) => a + b, 0);
  const HEAD_H = 34;
  const LINE = 20;
  const PAD = 14;
  const blue = "#2f6fdf";
  const blueSoft = "#e7effc";
  const border = "#c9d6ea";
  const text = "#1b1b1b";

  // 행 높이 계산(내용 줄바꿈 기준) — 폰트 먼저 지정
  ctx.font = `14px ${FONT}`;
  const detailLines = rows.map((r) => wrap(ctx, r.detail || "", COLS[2] - 16));
  const rowHs = detailLines.map((ls) => Math.max(2, ls.length) * LINE + PAD * 2);
  const top = 150;
  const tableH = HEAD_H + rowHs.reduce((a, b) => a + b, 0);
  const H = top + tableH + M * 2;

  canvas.width = W * S;
  canvas.height = H * S;
  ctx.scale(S, S);
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, W, H);
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  // 알약 라벨 + 제목
  const pillW = 170;
  const pillH = 30;
  const pillY = 36;
  ctx.fillStyle = blue;
  ctx.beginPath();
  ctx.roundRect((W - pillW) / 2, pillY, pillW, pillH, 6);
  ctx.fill();
  ctx.fillStyle = "#ffffff";
  ctx.font = `700 14px ${FONT}`;
  ctx.fillText("기타투게더 정기모임", W / 2, pillY + pillH / 2);
  ctx.fillStyle = text;
  ctx.font = `800 30px ${FONT}`;
  ctx.fillText(`${String(y).slice(2)}년 ${m}월 스케줄 안내`, W / 2, 106);

  // 머리글
  const colX = [M, M + COLS[0], M + COLS[0] + COLS[1]];
  ctx.fillStyle = blueSoft;
  ctx.fillRect(M, top, tableW, HEAD_H);
  ctx.fillStyle = blue;
  ctx.font = `700 13px ${FONT}`;
  ["일시", "주제", "내용"].forEach((h, i) => ctx.fillText(h, colX[i] + COLS[i] / 2, top + HEAD_H / 2));

  // 본문
  let yy = top + HEAD_H;
  rows.forEach((r, i) => {
    const cy = yy + rowHs[i] / 2;
    ctx.fillStyle = text;
    ctx.font = `700 13px ${FONT}`;
    ctx.fillText(`${i + 1}주차`, colX[0] + COLS[0] / 2, cy - 10);
    ctx.fillText(r.date, colX[0] + COLS[0] / 2, cy + 10);
    ctx.font = `700 15px ${FONT}`;
    ctx.fillText(r.topic, colX[1] + COLS[1] / 2, cy);
    ctx.font = `14px ${FONT}`;
    const ls = detailLines[i];
    ls.forEach((l, k) => ctx.fillText(l, colX[2] + COLS[2] / 2, cy + (k - (ls.length - 1) / 2) * LINE));
    yy += rowHs[i];
  });

  // 격자선
  ctx.strokeStyle = border;
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
  [M, colX[1], colX[2], M + tableW].forEach((x) => line(x, top, x, gy));

  canvas.toBlob((blob) => {
    if (!blob) return;
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `일정_${ym}.png`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 5000);
  }, "image/png");
}

export default function ScheduleEditor({ ym, initial }: { ym: string; initial: ScheduleRow[] }) {
  const router = useRouter();
  // 저장된 일정이 없으면 그 달 토요일로 미리 채운다
  const base = initial.length ? initial : saturdaysOf(ym).map((date) => ({ date, topic: "", detail: "" }));
  const [rows, setRows] = useState<ScheduleRow[]>(base);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const dirty = JSON.stringify(rows) !== JSON.stringify(base);
  useRefreshHold(dirty);

  const [y, m] = ym.split("-").map(Number);
  const set = (i: number, k: keyof ScheduleRow, v: string) =>
    setRows((prev) => prev.map((r, j) => (j === i ? { ...r, [k]: v } : r)));

  const save = async () => {
    setSaving(true);
    setError("");
    try {
      const res = await saveSchedule(ym, rows);
      if ("error" in res) setError(res.error);
      else router.refresh();
    } catch {
      setError("저장 요청이 실패했습니다. 네트워크를 확인하고 다시 눌러 주세요.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <div className="card" style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <Link href={`/schedule?ym=${shiftYm(ym, -1)}`} className="btn ghost btn-sm" aria-label="이전 달">
          ‹
        </Link>
        <strong style={{ fontSize: 16 }}>
          {y}년 {m}월
        </strong>
        <Link href={`/schedule?ym=${shiftYm(ym, 1)}`} className="btn ghost btn-sm" aria-label="다음 달">
          ›
        </Link>
      </div>

      {rows.map((r, i) => (
        <div className="card" key={i}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
            <strong>{i + 1}주차</strong>
            <button className="btn ghost btn-sm" onClick={() => setRows((p) => p.filter((_, j) => j !== i))}>
              삭제
            </button>
          </div>
          <div className="form-grid">
            <div className="field">
              <label>일시</label>
              <input className="input" value={r.date} maxLength={60} onChange={(e) => set(i, "date", e.target.value)} placeholder="11월 7일" />
            </div>
            <div className="field">
              <label>주제</label>
              <input className="input" value={r.topic} maxLength={60} onChange={(e) => set(i, "topic", e.target.value)} placeholder="개인 연습" />
            </div>
            <div className="field">
              <label>내용</label>
              <input className="input" value={r.detail} maxLength={60} onChange={(e) => set(i, "detail", e.target.value)} placeholder="연습실에서 영화 감상" />
            </div>
          </div>
        </div>
      ))}

      <div className="btn-row">
        {rows.length < MAX_ROWS && (
          <button className="btn btn-sm" onClick={() => setRows((p) => [...p, { date: "", topic: "", detail: "" }])}>
            주차 추가
          </button>
        )}
        <button className="btn amber btn-sm" onClick={() => drawPng(ym, rows)} disabled={rows.length === 0}>
          이미지 저장
        </button>
      </div>

      {dirty && (
        <div className="save-bar">
          {error ? <span className="save-bar-msg danger">{error}</span> : <span className="save-bar-msg">저장하지 않은 변경이 있습니다</span>}
          <button className="btn ghost btn-sm" onClick={() => setRows(base)} disabled={saving}>
            취소
          </button>
          <button className="btn amber btn-sm" onClick={save} disabled={saving}>
            {saving ? "저장 중…" : "저장"}
          </button>
        </div>
      )}
    </>
  );
}
