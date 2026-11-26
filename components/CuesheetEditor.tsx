"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  CH_COLS, FADER, FADER_MARKS, MASTER_COLS, MAX_CELL, MAX_MEMO, blankFx, defaultTeamCue, faderPos, hasValues, knobAngle,
  type ChKey, type Cuesheet, type FxRow, type MasterKey, type TeamCue,
} from "@/lib/cuesheet";
import { deleteCuesheet, saveCuesheet } from "@/lib/cuesheet-actions";
import { useRefreshHold } from "@/lib/refresh-hold";
import { downloadCuePng } from "./cuesheet-png";

type Team = { id: string; name: string };
type Pick =
  | { scope: "ch"; row: number; key: ChKey }
  | { scope: "master"; key: MasterKey }
  | null;

const fill = (sheet: Cuesheet, teams: Team[]) =>
  Object.fromEntries(teams.map((t) => [t.id, sheet.teams[t.id] ?? defaultTeamCue()])) as Record<string, TeamCue>;

export default function CuesheetEditor({ id, initial, teams }: { id: string; initial: Cuesheet; teams: Team[] }) {
  const router = useRouter();
  const [title, setTitle] = useState(initial.title);
  const [date, setDate] = useState(initial.date);
  const [data, setData] = useState(() => fill(initial, teams));
  // 마지막 저장본 — 바뀐 팀만 골라 보내고, 저장 후엔 현재 상태가 새 기준
  const [base, setBase] = useState(() => ({ title: initial.title, date: initial.date, teams: fill(initial, teams) }));
  const [active, setActive] = useState(teams[0]?.id ?? "");
  const [pick, setPick] = useState<Pick>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const changed = Object.fromEntries(
    Object.entries(data).filter(([tid, t]) => JSON.stringify(t) !== JSON.stringify(base.teams[tid])),
  );
  const dirty = title !== base.title || date !== base.date || Object.keys(changed).length > 0;
  useRefreshHold(dirty || pick !== null);

  useEffect(() => {
    if (!pick) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setPick(null);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [pick]);

  const cue = data[active];
  const idx = teams.findIndex((t) => t.id === active);
  const update = (fn: (t: TeamCue) => TeamCue) => setData((p) => ({ ...p, [active]: fn(p[active]) }));
  const setCh = (row: number, key: keyof TeamCue["ch"][number], v: string) =>
    update((t) => ({ ...t, ch: t.ch.map((r, i) => (i === row ? { ...r, [key]: v } : r)) }));
  const setMaster = (key: keyof TeamCue["master"], v: string) => update((t) => ({ ...t, master: { ...t.master, [key]: v } }));
  const setFx = (row: number, key: keyof FxRow, v: string) =>
    update((t) => ({ ...t, fx: t.fx.map((r, i) => (i === row ? { ...r, [key]: v } : r)) }));

  const copyPrev = () => {
    const prev = teams[idx - 1];
    if (!prev) return;
    if (hasValues(cue) && !window.confirm(`${teams[idx].name}에 기록된 값을 ${prev.name} 값으로 덮어쓸까요?`)) return;
    update(() => structuredClone(data[prev.id]));
  };

  const save = async () => {
    setSaving(true);
    setError("");
    try {
      const res = await saveCuesheet(id, { title, date }, changed);
      if ("error" in res) setError(res.error);
      else setBase({ title, date, teams: data });
    } catch {
      setError("저장 요청이 실패했습니다. 네트워크를 확인하고 다시 눌러 주세요.");
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!window.confirm(`"${base.title}" 큐시트를 삭제할까요? 되돌릴 수 없습니다.`)) return;
    const res = await deleteCuesheet(id);
    if ("error" in res) setError(res.error);
    else {
      router.push("/cuesheet");
      router.refresh();
    }
  };

  // 값 선택 시트
  type Sheet = { title: string; options: string[]; center?: string; value: string; set: (v: string) => void };
  const sheet = ((): Sheet | null => {
    if (pick?.scope === "ch" && cue) {
      const col = CH_COLS.find((c) => c.key === pick.key)!;
      const row = pick.row;
      if (col.options === "toggle") return null;
      return {
        title: `CH ${cue.ch[row].name} · ${col.label}`,
        options: col.options,
        center: col.center,
        value: cue.ch[row][pick.key],
        set: (v) => setCh(row, pick.key, v),
      };
    }
    if (pick?.scope === "master" && cue) {
      const col = MASTER_COLS.find((c) => c.key === pick.key)!;
      const key = pick.key;
      return { title: `마스터 · ${col.label}`, options: col.options, center: col.center, value: cue.master[key], set: (v) => setMaster(key, v) };
    }
    return null;
  })();

  if (!cue) {
    return (
      <div className="card">
        <p className="guide-note">정기공연 팀이 없습니다. 합주곡 탭에서 팀을 먼저 추가하세요.</p>
      </div>
    );
  }

  return (
    <>
      <div className="card cue-head">
        <Link href="/cuesheet" className="btn ghost btn-sm" aria-label="큐시트 목록">‹</Link>
        <input className="input" value={title} maxLength={60} onChange={(e) => setTitle(e.target.value)} aria-label="공연 이름" />
        <input className="input cue-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} aria-label="날짜" />
        <button className="btn ghost btn-sm" onClick={remove}>삭제</button>
      </div>

      <div className="tab-row wrap">
        {teams.map((t) => (
          <button key={t.id} className={`tab${active === t.id ? " active" : ""}`} onClick={() => setActive(t.id)}>
            {t.name}
            {changed[t.id] && <span className="tab-dot" aria-label="저장 안 됨" />}
          </button>
        ))}
      </div>

      <div key={active} className="tab-panel">
      <div className="btn-row">
        <button className="btn amber btn-sm" onClick={() => downloadCuePng({ title, date, team: teams[idx].name, cue })}>
          {teams[idx].name} 이미지 저장
        </button>
        {idx > 0 && (
          <button className="btn ghost btn-sm" onClick={copyPrev}>
            이전 팀({teams[idx - 1].name}) 값 복사
          </button>
        )}
      </div>

      <div className="section-title cue-section">
        <span>채널</span>
      </div>
      <div className="table-wrap">
        <table className="cue-table">
          {/* 믹서처럼 채널이 위, 노브가 위→아래 순서로 */}
          <thead>
            <tr>
              <th className="cue-sticky">CH</th>
              {cue.ch.map((r, i) => (
                <th key={i} className="cue-ch">
                  <input className="cue-name" value={r.name} maxLength={MAX_CELL} onChange={(e) => setCh(i, "name", e.target.value)} aria-label="채널 이름" />
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {CH_COLS.map((c) => (
              <tr key={c.key}>
                <th className="cue-sticky">{c.label}</th>
                {cue.ch.map((r, i) =>
                  c.options === "toggle" ? (
                    <td key={i}>
                      <button
                        className={`cue-cell${r.mute ? " muted" : ""}`}
                        onClick={() => setCh(i, "mute", r.mute ? "" : "M")}
                        aria-pressed={!!r.mute}
                        aria-label={`${r.name} Mute`}
                      >
                        {r.mute ? "MUTE" : "—"}
                      </button>
                    </td>
                  ) : (
                    <td key={i}>
                      <button
                        className={`cue-cell${r[c.key] ? " set" : ""}`}
                        onClick={() => setPick({ scope: "ch", row: i, key: c.key })}
                        aria-label={`${r.name} ${c.label}`}
                      >
                        <Val v={r[c.key]} fader={c.options === FADER} center={c.center} />
                      </button>
                    </td>
                  ),
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="section-title cue-section"><span>마스터</span></div>
      <div className="table-wrap">
        <table className="cue-table">
          <thead>
            <tr>
              {MASTER_COLS.map((c) => <th key={c.key}>{c.label}</th>)}
              <th>FX 프리셋</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              {MASTER_COLS.map((c) => (
                <td key={c.key}>
                  <button
                    className={`cue-cell${cue.master[c.key] ? " set" : ""}`}
                    onClick={() => setPick({ scope: "master", key: c.key })}
                    aria-label={`마스터 ${c.label}`}
                  >
                    <Val v={cue.master[c.key]} fader={c.options === FADER} center={c.center} />
                  </button>
                </td>
              ))}
              <td>
                <input className="cue-memo short" value={cue.master.fxPreset} maxLength={MAX_CELL} onChange={(e) => setMaster("fxPreset", e.target.value)} placeholder="47" aria-label="FX 프리셋" />
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <div className="section-title cue-section"><span>개인 이펙터</span></div>
      <div className="table-wrap">
        <table className="cue-table">
          <thead>
            <tr>
              <th>파트</th>
              <th>장비</th>
              <th>볼륨</th>
              <th>메모</th>
              <th aria-label="삭제" />
            </tr>
          </thead>
          <tbody>
            {cue.fx.map((f, i) => (
              <tr key={i}>
                <td><input className="cue-memo short" value={f.part} maxLength={MAX_CELL} onChange={(e) => setFx(i, "part", e.target.value)} aria-label="파트" /></td>
                <td><input className="cue-memo" value={f.gear} maxLength={MAX_CELL} onChange={(e) => setFx(i, "gear", e.target.value)} placeholder="장비 / 프리셋" aria-label="장비" /></td>
                <td><input className="cue-memo short" value={f.vol} maxLength={MAX_CELL} onChange={(e) => setFx(i, "vol", e.target.value)} aria-label="볼륨" /></td>
                <td><input className="cue-memo" value={f.memo} maxLength={MAX_MEMO} onChange={(e) => setFx(i, "memo", e.target.value)} aria-label="메모" /></td>
                <td>
                  <button className="btn ghost btn-sm" onClick={() => update((t) => ({ ...t, fx: t.fx.filter((_, j) => j !== i) }))} aria-label="행 삭제">×</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {cue.fx.length < 12 && (
        <div className="btn-row">
          <button className="btn btn-sm" onClick={() => update((t) => ({ ...t, fx: [...t.fx, blankFx()] }))}>이펙터 추가</button>
        </div>
      )}

      </div>

      {sheet && (
        <div className="cue-picker-back" onClick={() => setPick(null)}>
          <div className="cue-picker" role="dialog" aria-label={sheet.title} onClick={(e) => e.stopPropagation()}>
            <div className="cue-picker-head">
              <strong>{sheet.title}</strong>
              <button className="btn ghost btn-sm" onClick={() => setPick(null)}>닫기</button>
            </div>
            {sheet.options === FADER ? (
              <FaderPicker value={sheet.value} set={sheet.set} />
            ) : (
              <div className="cue-picker-grid">
                {sheet.options.map((o) => (
                  <button
                    key={o}
                    className={`cue-opt${o === sheet.value ? " on" : ""}${o === sheet.center ? " center" : ""}`}
                    onClick={() => {
                      sheet.set(o);
                      setPick(null);
                    }}
                  >
                    <Knob v={o} center={sheet.center} size={34} />
                    <span>{o}</span>
                  </button>
                ))}
              </div>
            )}
            <button
              className="btn ghost btn-sm cue-clear"
              onClick={() => {
                sheet.set("");
                setPick(null);
              }}
            >
              지우기
            </button>
          </div>
        </div>
      )}

      {dirty && (
        <div className="save-bar">
          {error ? <span className="save-bar-msg danger">{error}</span> : <span className="save-bar-msg">저장하지 않은 변경이 있습니다</span>}
          <button className="btn amber btn-sm" onClick={save} disabled={saving}>
            {saving ? "저장 중…" : "저장"}
          </button>
        </div>
      )}
      {!dirty && error && <p className="save-bar-msg danger">{error}</p>}
    </>
  );
}

/* ---------- 믹서 모양 표시 ---------- */

const pt = (r: number, deg: number, c: number) => {
  const a = (deg * Math.PI) / 180;
  return [c + r * Math.sin(a), c - r * Math.cos(a)];
};
const arc = (r: number, from: number, to: number, c: number) => {
  const [x1, y1] = pt(r, Math.min(from, to), c);
  const [x2, y2] = pt(r, Math.max(from, to), c);
  return `M${x1} ${y1}A${r} ${r} 0 ${Math.abs(to - from) > 180 ? 1 : 0} 1 ${x2} ${y2}`;
};

const HOURS = [-150, -120, -90, -60, -30, 0, 30, 60, 90, 120, 150]; // 7시~5시 정시 눈금

/** 노브 — 바깥 눈금(7·12·5시는 길게) + 링 + 몇 시 방향 포인터. 값까지 앰버(EQ·Pan은 12시부터 양쪽으로) */
function Knob({ v, center, size = 38 }: { v: string; center?: string; size?: number }) {
  const deg = knobAngle(v);
  const c = size / 2;
  const ring = c * 0.62;
  const from = center ? 0 : -150;
  const lit = (a: number) => deg != null && a >= Math.min(from, deg) && a <= Math.max(from, deg);
  const [px, py] = deg == null ? [c, c] : pt(c * 0.42, deg, c);
  return (
    <svg className="cue-knob" width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden>
      {HOURS.map((a) => {
        const major = a === -150 || a === 0 || a === 150;
        const [x1, y1] = pt(c - 0.5, a, c);
        const [x2, y2] = pt(c * (major ? 0.74 : 0.8), a, c);
        return <line key={a} x1={x1} y1={y1} x2={x2} y2={y2} className={`knob-tick${lit(a) ? " on" : ""}${major ? " major" : ""}`} />;
      })}
      <path d={arc(ring, -150, 150, c)} className="knob-track" />
      {deg != null && deg !== from && <path d={arc(ring, from, deg, c)} className="knob-fill" />}
      <circle cx={c} cy={c} r={c * 0.48} className="knob-cap" />
      {deg != null && <line x1={c} y1={c} x2={px} y2={py} className="knob-ptr" />}
    </svg>
  );
}

/** 미니 페이더 — 실제 페이더 간격(0dB가 위 1/4)으로 캡 위치, 왼쪽 눈금(0dB 강조) */
function FaderMini({ v }: { v: string }) {
  const pos = faderPos(v) ?? 0;
  const H = 116;
  const yOf = (p: number) => 7 + (1 - p) * (H - 14);
  return (
    <svg className="cue-fader" width={30} height={H} viewBox={`0 0 30 ${H}`} aria-hidden>
      {FADER_MARKS.map(([m, p]) => (
        <line key={m} x1={m === "0" ? 1 : 5} y1={yOf(p)} x2={10} y2={yOf(p)} className={m === "0" ? "fader-zero" : "fader-tick"} />
      ))}
      <line x1={20} y1={7} x2={20} y2={H - 7} className="fader-track" />
      <rect x={12} y={yOf(pos) - 6} width={16} height={12} rx={2} className="fader-cap" />
      <line x1={14} y1={yOf(pos)} x2={26} y2={yOf(pos)} className="fader-cap-line" />
    </svg>
  );
}

/** 표 셀 표시 — 값 없으면 "—", 있으면 노브/페이더 그림 + 숫자 */
function Val({ v, fader, center }: { v: string; fader: boolean; center?: string }) {
  if (!v) return <>—</>;
  return (
    <span className={fader ? "cue-val row" : "cue-val"}>
      {fader ? <FaderMini v={v} /> : <Knob v={v} center={center} />}
      <span className="cue-val-txt">{v}</span>
    </span>
  );
}

/** 페이더 팝업 — 캡을 끌거나 눈금을 눌러 조정, ▲▼로 한 칸씩. 바로 반영 */
function FaderPicker({ value, set }: { value: string; set: (v: string) => void }) {
  const track = useRef<HTMLDivElement>(null);
  const pos = faderPos(value);
  const idx = FADER.indexOf(value);
  const nearest = (p: number) =>
    FADER.reduce((best, v) => (Math.abs((faderPos(v) ?? 0) - p) < Math.abs((faderPos(best) ?? 0) - p) ? v : best), FADER[0]);
  const fromY = (clientY: number) => {
    const r = track.current?.getBoundingClientRect();
    if (!r) return;
    set(nearest(Math.min(1, Math.max(0, 1 - (clientY - r.top) / r.height))));
  };
  const step = (d: number) => set(FADER[Math.min(FADER.length - 1, Math.max(0, (idx < 0 ? FADER.indexOf("0") : idx + d)))]);
  return (
    <div className="fader-pick">
      <div className="fader-pick-side">
        <strong className="fader-pick-val">{value ? `${value} dB` : "—"}</strong>
        <button className="btn btn-sm" onClick={() => step(1)} aria-label="한 칸 올리기">▲</button>
        <button className="btn btn-sm" onClick={() => step(-1)} aria-label="한 칸 내리기">▼</button>
      </div>
      <div className="fader-pick-scale">
        {FADER_MARKS.map(([m, p]) => (
          <button key={m} className="fader-mark" style={{ top: `${(1 - p) * 100}%` }} onClick={() => set(m)}>
            {m}
          </button>
        ))}
      </div>
      <div
        ref={track}
        className="fader-pick-track"
        role="slider"
        aria-orientation="vertical"
        aria-label="페이더"
        aria-valuetext={value || "없음"}
        onPointerDown={(e) => {
          e.currentTarget.setPointerCapture(e.pointerId);
          fromY(e.clientY);
        }}
        onPointerMove={(e) => e.buttons && fromY(e.clientY)}
      >
        <div className="fader-pick-slot" />
        {pos != null && <div className="fader-pick-cap" style={{ top: `${(1 - pos) * 100}%` }} />}
      </div>
    </div>
  );
}
