// 큐시트 팀별 PNG — 화면 표와 같은 배치(채널이 위, 노브가 아래로)를 흰 배경으로 그린다. 인쇄·공유용.
import { CH_COLS, FADER, FADER_MARKS, MASTER_COLS, faderPos, knobAngle, type TeamCue } from "@/lib/cuesheet";

const S = 2; // 고해상도
const M = 24;
const LABEL_W = 76;
const COL_W = 80;
const HEAD_H = 40;
const KNOB_H = 64;
const MUTE_H = 36;
const FADER_H = 140;
const C = {
  text: "#1b1b1b",
  muted: "#6b7480",
  line: "#d5dbe3",
  head: "#f2f4f7",
  accent: "#e0972a",
  tick: "#a7b0ba",
  track: "#cfd5dc",
  danger: "#d0452b",
  dangerSoft: "#fbe7e2",
};

const rad = (deg: number) => ((deg - 90) * Math.PI) / 180; // 12시=0 → 캔버스 각도

function drawKnob(ctx: CanvasRenderingContext2D, cx: number, cy: number, size: number, v: string, center?: string) {
  const deg = knobAngle(v);
  const c = size / 2;
  const from = center ? 0 : -150;
  const lo = deg == null ? 0 : Math.min(from, deg);
  const hi = deg == null ? 0 : Math.max(from, deg);
  ctx.lineCap = "round";
  for (let a = -150; a <= 150; a += 30) {
    const major = a === -150 || a === 0 || a === 150;
    const r2 = c * (major ? 0.74 : 0.8);
    ctx.strokeStyle = deg != null && a >= lo && a <= hi ? C.accent : C.tick;
    ctx.lineWidth = major ? 1.5 : 1;
    ctx.beginPath();
    ctx.moveTo(cx + (c - 0.5) * Math.cos(rad(a)), cy + (c - 0.5) * Math.sin(rad(a)));
    ctx.lineTo(cx + r2 * Math.cos(rad(a)), cy + r2 * Math.sin(rad(a)));
    ctx.stroke();
  }
  ctx.lineWidth = 2.5;
  ctx.strokeStyle = C.track;
  ctx.beginPath();
  ctx.arc(cx, cy, c * 0.62, rad(-150), rad(150));
  ctx.stroke();
  if (deg != null && deg !== from) {
    ctx.strokeStyle = C.accent;
    ctx.beginPath();
    ctx.arc(cx, cy, c * 0.62, rad(lo), rad(hi));
    ctx.stroke();
  }
  ctx.fillStyle = "#f7f8fa";
  ctx.strokeStyle = C.muted;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.arc(cx, cy, c * 0.48, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  if (deg != null) {
    ctx.strokeStyle = C.text;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(cx + c * 0.42 * Math.cos(rad(deg)), cy + c * 0.42 * Math.sin(rad(deg)));
    ctx.stroke();
  }
}

/** 페이더 — x: 트랙 중심, top~top+h. 왼쪽 눈금(0dB 굵게), 캡 */
function drawFader(ctx: CanvasRenderingContext2D, x: number, top: number, h: number, v: string) {
  const yOf = (p: number) => top + (1 - p) * h;
  for (const [m, p] of FADER_MARKS) {
    ctx.strokeStyle = m === "0" ? C.text : C.tick;
    ctx.lineWidth = m === "0" ? 1.5 : 1;
    ctx.beginPath();
    ctx.moveTo(x - (m === "0" ? 18 : 14), yOf(p));
    ctx.lineTo(x - 8, yOf(p));
    ctx.stroke();
  }
  ctx.strokeStyle = C.track;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(x, top);
  ctx.lineTo(x, top + h);
  ctx.stroke();
  const pos = faderPos(v);
  if (pos == null) return;
  const y = yOf(pos);
  ctx.fillStyle = "#3a4048";
  ctx.beginPath();
  ctx.roundRect(x - 9, y - 7, 18, 14, 2);
  ctx.fill();
  ctx.strokeStyle = "#ffffff";
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(x - 7, y);
  ctx.lineTo(x + 7, y);
  ctx.stroke();
}

/** 칸 폭에 맞게 글자 크기를 줄여 한 줄로 */
function fitText(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, maxW: number, size: number, font: string, weight = 700) {
  let s = size;
  ctx.font = `${weight} ${s}px ${font}`;
  while (s > 9 && ctx.measureText(text).width > maxW) ctx.font = `${weight} ${--s}px ${font}`;
  ctx.fillText(text, x, y);
}

export function downloadCuePng(opts: { title: string; date: string; team: string; cue: TeamCue }) {
  const { title, date, team, cue } = opts;
  const font = getComputedStyle(document.body).fontFamily || "sans-serif";
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  const n = cue.ch.length;
  const tableW = LABEL_W + COL_W * n;
  const W = tableW + M * 2;
  const rowH = CH_COLS.map((c) => (c.options === "toggle" ? MUTE_H : c.options === FADER ? FADER_H : KNOB_H));
  const chH = HEAD_H + rowH.reduce((a, b) => a + b, 0);
  const masterColW = tableW / (MASTER_COLS.length + 1);
  const masterH = HEAD_H + FADER_H;
  const fx = cue.fx.filter((f) => f.part || f.gear || f.vol || f.memo);
  const fxH = fx.length ? HEAD_H + fx.length * 36 : 0;
  const SEC = 34; // 섹션 제목 높이
  const top = 96;
  const H = top + SEC + chH + 24 + SEC + masterH + (fx.length ? 24 + SEC + fxH : 0) + M;

  canvas.width = W * S;
  canvas.height = H * S;
  ctx.scale(S, S);
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, W, H);
  ctx.textBaseline = "middle";

  // 제목
  ctx.textAlign = "left";
  ctx.fillStyle = C.text;
  ctx.font = `800 26px ${font}`;
  ctx.fillText(`${team}`, M, 40);
  ctx.fillStyle = C.muted;
  ctx.font = `500 15px ${font}`;
  ctx.fillText(`${title} · ${date} · 큐시트`, M, 72);

  const section = (label: string, y: number) => {
    ctx.textAlign = "left";
    ctx.fillStyle = C.text;
    ctx.font = `800 16px ${font}`;
    ctx.fillText(label, M, y + SEC / 2);
  };
  const grid = (x: number, y: number, colWs: number[], rowHs: number[]) => {
    const w = colWs.reduce((a, b) => a + b, 0);
    const h = rowHs.reduce((a, b) => a + b, 0);
    ctx.fillStyle = C.head;
    ctx.fillRect(x, y, w, rowHs[0]);
    ctx.strokeStyle = C.line;
    ctx.lineWidth = 1;
    ctx.beginPath();
    let yy = y;
    for (const rh of [0, ...rowHs]) {
      yy += rh;
      ctx.moveTo(x, yy);
      ctx.lineTo(x + w, yy);
    }
    let xx = x;
    for (const cw of [0, ...colWs]) {
      xx += cw;
      ctx.moveTo(xx, y);
      ctx.lineTo(xx, y + h);
    }
    ctx.stroke();
  };
  const dash = (cx: number, cy: number) => {
    ctx.fillStyle = C.tick;
    ctx.font = `400 13px ${font}`;
    ctx.fillText("—", cx, cy);
  };
  const knobCell = (cx: number, y: number, h: number, v: string, center?: string) => {
    if (!v) return dash(cx, y + h / 2);
    drawKnob(ctx, cx, y + h / 2 - 7, 38, v, center);
    ctx.fillStyle = C.text;
    ctx.font = `700 12px ${font}`;
    ctx.fillText(v, cx, y + h - 9);
  };
  const faderCell = (cx: number, y: number, h: number, v: string) => {
    if (!v) return dash(cx, y + h / 2);
    drawFader(ctx, cx - 4, y + 14, h - 28, v);
    ctx.textAlign = "left";
    ctx.fillStyle = C.text;
    ctx.font = `700 13px ${font}`;
    ctx.fillText(v, cx + 10, y + 14 + (1 - (faderPos(v) ?? 0)) * (h - 28));
    ctx.textAlign = "center";
  };

  // 채널 — 채널이 위, 노브가 아래로
  let y = top;
  section("채널", y);
  y += SEC;
  grid(M, y, [LABEL_W, ...cue.ch.map(() => COL_W)], [HEAD_H, ...rowH]);
  ctx.textAlign = "center";
  ctx.fillStyle = C.muted;
  ctx.font = `700 12px ${font}`;
  ctx.fillText("CH", M + LABEL_W / 2, y + HEAD_H / 2);
  ctx.fillStyle = C.text;
  cue.ch.forEach((r, i) => fitText(ctx, r.name, M + LABEL_W + COL_W * (i + 0.5), y + HEAD_H / 2, COL_W - 8, 13, font));
  let ry = y + HEAD_H;
  CH_COLS.forEach((col, k) => {
    const h = rowH[k];
    ctx.fillStyle = C.muted;
    ctx.font = `700 12px ${font}`;
    ctx.fillText(col.label, M + LABEL_W / 2, ry + h / 2);
    cue.ch.forEach((r, i) => {
      const x0 = M + LABEL_W + COL_W * i;
      const cx = x0 + COL_W / 2;
      const v = r[col.key];
      if (col.options === "toggle") {
        if (v) {
          ctx.fillStyle = C.dangerSoft;
          ctx.fillRect(x0 + 1, ry + 1, COL_W - 2, h - 2);
          ctx.fillStyle = C.danger;
          ctx.font = `800 12px ${font}`;
          ctx.fillText("MUTE", cx, ry + h / 2);
        } else dash(cx, ry + h / 2);
      } else if (col.options === FADER) faderCell(cx, ry, h, v);
      else knobCell(cx, ry, h, v, col.center);
    });
    ry += h;
  });
  y += chH + 24;

  // 마스터
  section("마스터", y);
  y += SEC;
  const mCols = [...MASTER_COLS.map(() => masterColW), masterColW];
  grid(M, y, mCols, [HEAD_H, FADER_H]);
  ctx.textAlign = "center";
  [...MASTER_COLS.map((c) => c.label), "FX 프리셋"].forEach((l, i) => {
    ctx.fillStyle = C.muted;
    ctx.font = `700 12px ${font}`;
    ctx.fillText(l, M + masterColW * (i + 0.5), y + HEAD_H / 2);
  });
  MASTER_COLS.forEach((c, i) => {
    const cx = M + masterColW * (i + 0.5);
    const v = cue.master[c.key];
    if (c.options === FADER) faderCell(cx, y + HEAD_H, FADER_H, v);
    else knobCell(cx, y + HEAD_H + (FADER_H - KNOB_H) / 2, KNOB_H, v, c.center);
  });
  const fxCx = M + masterColW * (MASTER_COLS.length + 0.5);
  if (cue.master.fxPreset) {
    ctx.fillStyle = C.text;
    ctx.font = `800 16px ${font}`;
    ctx.fillText(cue.master.fxPreset, fxCx, y + HEAD_H + FADER_H / 2);
  } else dash(fxCx, y + HEAD_H + FADER_H / 2);
  y += masterH + 24;

  // 개인 이펙터 (입력된 줄만)
  if (fx.length) {
    section("개인 이펙터", y);
    y += SEC;
    const fw = [110, 240, 100];
    const cols = [...fw, tableW - fw.reduce((a, b) => a + b, 0)];
    grid(M, y, cols, [HEAD_H, ...fx.map(() => 36)]);
    const xs = cols.map((_, i) => M + cols.slice(0, i).reduce((a, b) => a + b, 0));
    ["파트", "장비", "볼륨", "메모"].forEach((h, i) => {
      ctx.fillStyle = C.muted;
      ctx.font = `700 12px ${font}`;
      ctx.fillText(h, xs[i] + cols[i] / 2, y + HEAD_H / 2);
    });
    fx.forEach((f, r) => {
      const cy = y + HEAD_H + 36 * r + 18;
      ctx.fillStyle = C.text;
      [f.part, f.gear, f.vol, f.memo].forEach((t, i) => fitText(ctx, t || "", xs[i] + cols[i] / 2, cy, cols[i] - 12, 13, font, i === 0 ? 700 : 500));
    });
  }

  canvas.toBlob((blob) => {
    if (!blob) return;
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `큐시트_${date}_${team}.png`.replace(/[\\/:*?"<>|]/g, "_");
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 5000);
  }, "image/png");
}
