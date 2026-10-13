"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { StageMapSvg } from "./SoundGuide";
import { saveSoundGuide } from "@/lib/sound-guide-actions";
import { DEFAULT_SOUND_GUIDE, MAP_VIEWBOX, type MapItem, type SoundGuideData } from "@/lib/sound-guide-data";
import { DEFAULT_TEXTS, TEXT_FIELDS } from "@/lib/sound-guide-texts";

const TEXT_TABS = [...new Set(TEXT_FIELDS.map((f) => f.tab))];

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

export default function SoundGuideEditor({ initial }: { initial: SoundGuideData }) {
  const router = useRouter();
  const [items, setItems] = useState(initial.items);
  const [monitors, setMonitors] = useState(initial.monitors);
  const [texts, setTexts] = useState(initial.texts);
  const [textTab, setTextTab] = useState(0);
  const [selected, setSelected] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const svgRef = useRef<SVGSVGElement>(null);
  const drag = useRef<{ id: string; dx: number; dy: number } | null>(null);

  // 화면 좌표 → SVG viewBox 좌표
  const toSvg = (e: React.PointerEvent) => {
    const svg = svgRef.current!;
    return new DOMPoint(e.clientX, e.clientY).matrixTransform(svg.getScreenCTM()!.inverse());
  };
  const onItemDown = (id: string, e: React.PointerEvent<SVGGElement>) => {
    const it = items.find((i) => i.id === id)!;
    const p = toSvg(e);
    drag.current = { id, dx: it.x - p.x, dy: it.y - p.y };
    svgRef.current!.setPointerCapture(e.pointerId);
    setSelected(id);
  };
  const onMove = (e: React.PointerEvent<SVGSVGElement>) => {
    const d = drag.current;
    if (!d) return;
    const p = toSvg(e);
    const v = MAP_VIEWBOX;
    setItems((prev) =>
      prev.map((it) =>
        it.id === d.id
          ? {
              ...it,
              x: Math.round(clamp(p.x + d.dx, v.x + it.w / 2, v.x + v.w - it.w / 2)),
              y: Math.round(clamp(p.y + d.dy, v.y + it.h / 2, v.y + v.h - it.h / 2)),
            }
          : it,
      ),
    );
  };
  const onUp = () => {
    drag.current = null;
  };

  const patch = (id: string, p: Partial<MapItem>) =>
    setItems((prev) => prev.map((it) => (it.id === id ? { ...it, ...p } : it)));
  const add = (kind: MapItem["kind"]) => {
    const id = `${kind}-${Date.now().toString(36)}`;
    const v = MAP_VIEWBOX;
    const cx = v.x + v.w / 2;
    const cy = v.y + v.h / 2;
    const it: MapItem =
      kind === "amp"
        ? { id, kind, shape: "rect", x: cx, y: cy, w: 110, h: 70, label: "AUX", sub: "모니터" }
        : { id, kind, shape: "ellipse", x: cx, y: cy, w: 92, h: 60, label: "자리" };
    setItems((prev) => [...prev, it]);
    setSelected(id);
  };
  const remove = (id: string) => {
    setItems((prev) => prev.filter((it) => it.id !== id));
    if (selected === id) setSelected(null);
  };
  const setCell = (r: number, c: number, v: string) =>
    setMonitors((prev) =>
      prev.map((row, i) => (i === r ? (row.map((x, j) => (j === c ? v : x)) as typeof row) : row)),
    );

  const save = async () => {
    setSaving(true);
    setError("");
    const res = await saveSoundGuide({ items, monitors, texts });
    setSaving(false);
    if ("error" in res) {
      setError(res.error);
      return;
    }
    router.push("/sound-guide?tab=1");
    router.refresh();
  };

  return (
    <>
      <div className="section-title">배치도 — 끌어서 옮기기</div>
      <div className="card">
        <StageMapSvg
          items={items}
          selected={selected}
          onItemDown={onItemDown}
          svgRef={svgRef}
          onPointerMove={onMove}
          onPointerUp={onUp}
          onPointerCancel={onUp}
          style={{ touchAction: "none", userSelect: "none" }}
        />
        <div className="btn-row">
          <button className="btn btn-sm" onClick={() => add("amp")}>
            + 앰프
          </button>
          <button className="btn btn-sm" onClick={() => add("player")}>
            + 자리
          </button>
          <button className="btn btn-sm ghost" onClick={() => setItems(DEFAULT_SOUND_GUIDE.items)}>
            기본 배치로
          </button>
        </div>
      </div>

      <div className="section-title">배치도 이름</div>
      <div className="table-wrap">
        <table className="mtable">
          <thead>
            <tr>
              <th>구분</th>
              <th>이름</th>
              <th>아래 글자</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {items.map((it) => (
              <tr key={it.id} className={selected === it.id ? "selected" : ""} onClick={() => setSelected(it.id)}>
                <td className="dim">{it.kind === "amp" ? "앰프" : "자리"}</td>
                <td>
                  <input
                    className="input"
                    value={it.label}
                    maxLength={20}
                    onChange={(e) => patch(it.id, { label: e.target.value })}
                  />
                </td>
                <td>
                  {it.kind === "amp" && (
                    <input
                      className="input"
                      value={it.sub ?? ""}
                      maxLength={20}
                      onChange={(e) => patch(it.id, { sub: e.target.value })}
                    />
                  )}
                </td>
                <td>
                  <button className="btn btn-sm danger" onClick={() => remove(it.id)}>
                    삭제
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="section-title">모니터 앰프 표</div>
      <div className="table-wrap">
        <table className="mtable">
          <thead>
            <tr>
              <th>번호</th>
              <th>어느 앰프</th>
              <th>기종</th>
              <th>위치</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {monitors.map((row, r) => (
              <tr key={r}>
                {row.map((cell, c) => (
                  <td key={c}>
                    <input className="input" value={cell} maxLength={40} onChange={(e) => setCell(r, c, e.target.value)} />
                  </td>
                ))}
                <td>
                  <button
                    className="btn btn-sm danger"
                    onClick={() => setMonitors((p) => p.filter((_, i) => i !== r))}
                  >
                    삭제
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="btn-row">
        <button className="btn btn-sm" onClick={() => setMonitors((p) => [...p, ["", "", "", ""]])}>
          + 줄 추가
        </button>
      </div>

      <div className="section-title">문장</div>
      <div className="card">
        <p className="guide-note" style={{ marginBottom: 10 }}>
          굵게는 **이렇게** 감쌉니다. 순서 목록은 줄마다 한 단계, 파트·Q&amp;A는 항목 사이를 빈 줄로 띄웁니다. 사진 위 글자와 노브 표는
          고정입니다.
        </p>
        <div className="tab-row">
          {TEXT_TABS.map((name, i) => (
            <button key={name} className={`tab${textTab === i ? " active" : ""}`} onClick={() => setTextTab(i)}>
              {name}
            </button>
          ))}
        </div>
        {TEXT_FIELDS.filter((f) => f.tab === TEXT_TABS[textTab]).map((f) => (
          <div key={f.key} className="field" style={{ marginTop: 12 }}>
            <label>
              {f.label}
              {texts[f.key] !== DEFAULT_TEXTS[f.key] && (
                <button
                  className="btn btn-sm ghost"
                  style={{ marginLeft: 8 }}
                  onClick={() => setTexts((p) => ({ ...p, [f.key]: DEFAULT_TEXTS[f.key] }))}
                >
                  기본 문장으로
                </button>
              )}
            </label>
            <textarea
              className="input"
              rows={f.rows ?? 1}
              value={texts[f.key]}
              maxLength={6000}
              onChange={(e) => setTexts((p) => ({ ...p, [f.key]: e.target.value }))}
            />
          </div>
        ))}
      </div>

      {error && (
        <p className="guide-note" style={{ color: "var(--danger)", marginTop: 12 }}>
          {error}
        </p>
      )}
      <div className="btn-row" style={{ marginTop: 16 }}>
        <button className="btn amber" onClick={save} disabled={saving}>
          {saving ? "저장 중…" : "저장"}
        </button>
        <button className="btn ghost" onClick={() => router.push("/sound-guide?tab=1")} disabled={saving}>
          취소
        </button>
      </div>
    </>
  );
}
