"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { MAP_VIEWBOX, type MapItem, type SoundGuideData } from "@/lib/sound-guide-data";
import { blocks, lines } from "@/lib/sound-guide-texts";

// 음향 사용방법 — 탭 5개(빠른 시작 · 배치도 · 믹서 · 파트별 · 문제해결). 로그인 없이 공개(QR).
// 장비: Alto Live 1604 믹서 + 모니터 앰프 4대(AUX1·2·3, SUB1). 메인 스피커 없음.
// 사진(public/sound-guide/mixer.jpg, 1200x750 — Alto 공식 탑뷰) 위에 SVG로 표시를 그린다. 좌표는 사진 픽셀 기준.

const TABS = ["빠른 시작", "배치도", "믹서·채널", "파트별", "문제해결"] as const;


const T = ({ children }: { children: React.ReactNode }) => <b style={{ color: "var(--text)" }}>{children}</b>;

/** **굵게** 표기를 <b>로 렌더 */
function md(s: string): React.ReactNode {
  return s.split("**").map((p, i) => (i % 2 ? <T key={i}>{p}</T> : p));
}
/** 줄마다 한 항목인 순서 목록 */
const Steps = ({ text }: { text: string }) => (
  <ol className="guide-steps">
    {lines(text).map((l, i) => (
      <li key={i}>{md(l)}</li>
    ))}
  </ol>
);

// 핵심 표: 행 = 키우고 싶은 소리(채널), 열 = 어느 스피커(AUX 번호). 칸 = 돌릴 노브.
const SPEAKERS: [string, string][] = [
  ["모니터 1", "AUX 1"],
  ["모니터 2", "AUX 2"],
  ["모니터 3", "AUX 3"],
  ["모니터 4", "SUB 1"],
];
const SOURCES: [string, string][] = [
  ["보컬", "1·2"],
  ["EG1", "7"],
  ["EG2", "8"],
  ["베이스", "5"],
  ["드럼", "6"],
  ["키보드", "9/10"],
  ["미니앰프", "11/12"],
];

function KnobMatrix({ t }: { t: Record<string, string> }) {
  return (
    <>
      <div className="section-title">{t["knob.title"]}</div>
      <div className="card" style={{ padding: "12px 16px" }}>
        <p className="guide-note" style={{ fontSize: 15, color: "var(--text)", fontWeight: 700 }}>
          {md(t["knob.lead"])}
        </p>
        <p className="guide-note">{md(t["knob.example"])}</p>
        <p className="guide-note">{md(t["knob.exception"])}</p>
      </div>
      <div className="table-wrap mt-12">
        <table className="mtable knob-matrix">
          <thead>
            <tr>
              <th>키우고 싶은 소리 ↓ / 스피커 →</th>
              {SPEAKERS.map(([name, aux]) => (
                <th key={aux}>
                  {name}
                  <br />
                  <span className="dim">{aux}</span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {SOURCES.map(([name, ch]) => (
              <tr key={name}>
                <th>
                  {name} <span className="dim">{ch}번</span>
                </th>
                {SPEAKERS.map(([, aux]) =>
                  aux === "SUB 1" ? (
                    <td key={aux} className={name === "베이스" ? "" : "dim"}>
                      {name === "베이스" ? "SUB1 페이더" : "안 나감"}
                    </td>
                  ) : (
                    <td key={aux}>
                      {ch}번 {aux}
                    </td>
                  ),
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="card mt-12">
        <p className="guide-note">{md(t["knob.note"])}</p>
      </div>
    </>
  );
}

/** 회원이 만져도 되는 곳 3군데 — 콘솔 전체 사진에 박스 표시 */
function AllowedShot({ caption }: { caption: string }) {
  const x0 = CX(1) - 22;
  const x1 = CX(10) + 22;
  return (
    <Shot
      crop={[235, 60, 700, 605]}
      marks={[
        { x: (x0 + x1) / 2, y: (Y.aux1 + Y.fx) / 2, w: x1 - x0, h: Y.fx - Y.aux1 + 30 },
        { x: (x0 + x1) / 2, y: Y.mute, w: x1 - x0, h: 22 },
        { x: (x0 + MASTER.sub1Fader.x + 16) / 2, y: 577, w: MASTER.sub1Fader.x + 16 - x0, h: 100 },
      ]}
      labels={[
        { text: "① AUX 노브", x: x1 + 8, y: 372 },
        { text: "② MUTE", x: x1 + 8, y: 492 },
        { text: "③ 페이더 + SUB1 페이더", x: 560, y: 646 },
      ]}
      caption={caption}
    />
  );
}

/* ---------- 콘솔 사진 좌표 ---------- */
// 채널 n(1~8 모노, 9 = 9/10, 10 = 11/12)의 노브 열 x
const CX = (ch: number) => 237 + 40.5 * ch;
const SUB_BTN_X = (ch: number) => CX(ch) + 17; // SUB 1-2 버튼 (페이더 오른쪽 작은 버튼)
const Y = {
  gain: 209,
  hi: 265,
  low: 337,
  aux1: 360,
  aux2: 385,
  aux3: 420,
  fx: 442,
  pan: 465,
  mute: 492,
  sub12: 545,
  fader0: 560,
};
const MASTER = {
  sub1Fader: { x: 760, y: 549 },
};

type Mark = { x: number; y: number; r?: number; w?: number; h?: number };
type Label = { text: string; x: number; y: number; lead?: [number, number, number, number]; end?: boolean };

function Shot({
  crop,
  marks = [],
  labels = [],
  caption,
}: {
  crop: [number, number, number, number];
  marks?: Mark[];
  labels?: Label[];
  caption?: React.ReactNode;
}) {
  const [x, y, w, h] = crop;
  const fs = w / 26; // 화면 폭 350px 기준 약 13px
  return (
    <figure className="guide-shot">
      <svg viewBox={`${x} ${y} ${w} ${h}`} role="img">
        <image href="/sound-guide/mixer.jpg" x="0" y="0" width="1200" height="750" />
        {marks.map((m, i) =>
          m.w && m.h ? (
            <rect key={i} className="mark" x={m.x - m.w / 2} y={m.y - m.h / 2} width={m.w} height={m.h} rx={6} />
          ) : (
            <circle key={i} className="mark" cx={m.x} cy={m.y} r={m.r ?? 14} />
          ),
        )}
        {labels.map((l, i) => (
          <g key={i}>
            {l.lead && <line className="lead" x1={l.lead[0]} y1={l.lead[1]} x2={l.lead[2]} y2={l.lead[3]} />}
            <text x={l.x} y={l.y} fontSize={fs} textAnchor={l.end ? "end" : "start"}>
              {l.text}
            </text>
          </g>
        ))}
      </svg>
      {caption && <figcaption>{caption}</figcaption>}
    </figure>
  );
}

/** "○○ 소리를 △△ 모니터에서 키우기" 예시 — 채널 a~b 구간의 AUX 줄을 확대 */
function AuxExample({
  chs,
  row,
  title,
  text,
  label,
}: {
  chs: number[];
  row: keyof typeof Y;
  title: string;
  text: string;
  label: string;
}) {
  const lo = Math.min(...chs);
  const hi = Math.max(...chs);
  const x0 = CX(lo) - 50;
  const x1 = CX(hi) + 100;
  return (
    <div className="card">
      <h4 className="guide-ex-title">{title}</h4>
      <Shot
        crop={[x0, Y.aux1 - 30, x1 - x0, Y.pan - Y.aux1 + 50]}
        marks={chs.map((c) => ({ x: CX(c), y: Y[row] }))}
        labels={[{ text: label, x: CX(hi) + 22, y: Y[row] + 1 }]}
        caption={text}
      />
    </div>
  );
}

/* ---------- 탭 1: 빠른 시작 ---------- */
function QuickStart({ data }: { data: SoundGuideData }) {
  const t = data.texts;
  return (
    <>
      <div className="card guide-intro">
        {lines(t["quick.intro"]).map((l, i) => (
          <p key={i}>{md(l)}</p>
        ))}
      </div>

      <div className="section-title">{t["quick.on.title"]}</div>
      <div className="card">
        <Steps text={t["quick.on"]} />
      </div>

      <KnobMatrix t={t} />

      <div className="section-title">{t["quick.touch.title"]}</div>
      <div className="card">
        <Steps text={t["quick.touch"]} />
      </div>
      <AllowedShot caption={t["quick.allowed.caption"]} />
      <Shot
        crop={[182, 195, 160, 290]}
        labels={[
          { text: "GAIN · 손대지 않음", x: 186, y: Y.gain + 1, lead: [CX(1) - 30, Y.gain, CX(1) - 12, Y.gain] },
          { text: "EQ · 손대지 않음", x: 186, y: 300, lead: [CX(1) - 30, 300, CX(1) - 12, 300] },
          { text: "AUX 1 → 모니터 1", x: 186, y: Y.aux1 + 1, lead: [CX(1) - 30, Y.aux1, CX(1) - 12, Y.aux1] },
          { text: "AUX 2 → 모니터 2", x: 186, y: Y.aux2 + 1, lead: [CX(1) - 30, Y.aux2, CX(1) - 12, Y.aux2] },
          { text: "AUX 3 → 모니터 3 (페이더↑)", x: 186, y: Y.aux3 + 1, lead: [CX(1) - 30, Y.aux3, CX(1) - 12, Y.aux3] },
          { text: "AUX 4 → 에코", x: 186, y: Y.fx + 1, lead: [CX(1) - 30, Y.fx, CX(1) - 12, Y.fx] },
          { text: "PAN · 손대지 않음", x: 186, y: Y.pan + 1, lead: [CX(1) - 30, Y.pan, CX(1) - 12, Y.pan] },
        ]}
        caption={t["quick.channel.caption"]}
      />
      <Shot
        crop={[182, 480, 160, 150]}
        labels={[
          { text: "MUTE · 불 꺼짐", x: 186, y: Y.mute + 1, lead: [CX(1) - 30, Y.mute, CX(1) - 14, Y.mute] },
          { text: "SUB 1-2 · 베이스만 (운영진)", x: 186, y: Y.sub12 + 1, lead: [CX(1) - 30, Y.sub12, SUB_BTN_X(1) - 6, Y.sub12] },
          { text: "페이더 · 0 선까지", x: 186, y: 600, lead: [CX(1) - 30, 600, CX(1) - 10, Y.fader0 + 8] },
        ]}
      />

      <div className="section-title">{t["quick.off.title"]}</div>
      <div className="card">
        <Steps text={t["quick.off"]} />
      </div>

      <div className="section-title">{t["quick.dont.title"]}</div>
      <div className="card">
        <Steps text={t["quick.dont"]} />
      </div>
    </>
  );
}

/* ---------- 탭 2: 배치도 ---------- */
/** 배치도 SVG — 안내 페이지와 편집 페이지(드래그)가 공유. 좌표는 lib/sound-guide-data MAP_VIEWBOX 기준 */
export function StageMapSvg({
  items,
  selected,
  onItemDown,
  svgRef,
  ...svgProps
}: {
  items: MapItem[];
  selected?: string | null;
  onItemDown?: (id: string, e: React.PointerEvent<SVGGElement>) => void;
  svgRef?: React.Ref<SVGSVGElement>;
} & Omit<React.SVGProps<SVGSVGElement>, "ref">) {
  const v = MAP_VIEWBOX;
  return (
    <svg
      ref={svgRef}
      className="guide-map"
      viewBox={`${v.x} ${v.y} ${v.w} ${v.h}`}
      role="img"
      aria-label="합주실 배치도"
      {...svgProps}
    >
      <rect className="wall" x={v.x + 10} y={v.y + 10} width={v.w - 20} height={v.h - 20} rx="16" />
      {items.map((it) => (
        <g
          key={it.id}
          className={`map-item${selected === it.id ? " selected" : ""}${onItemDown ? " draggable" : ""}`}
          onPointerDown={onItemDown ? (e) => onItemDown(it.id, e) : undefined}
        >
          {it.shape === "ellipse" ? (
            <ellipse className={it.kind} cx={it.x} cy={it.y} rx={it.w / 2} ry={it.h / 2} />
          ) : (
            <rect
              className={it.kind}
              x={it.x - it.w / 2}
              y={it.y - it.h / 2}
              width={it.w}
              height={it.h}
              rx={it.kind === "amp" ? 10 : 8}
            />
          )}
          <text x={it.x} y={it.sub ? it.y - 9 : it.y}>
            {it.label}
          </text>
          {it.sub && (
            <text className="sub" x={it.x} y={it.y + 17}>
              {it.sub}
            </text>
          )}
        </g>
      ))}
    </svg>
  );
}

function StageMap({ data }: { data: SoundGuideData }) {
  return (
    <>
      <div className="card">
        <StageMapSvg items={data.items} />
        <p className="guide-note" style={{ marginTop: 10 }}>
          {md(data.texts["map.note"])}
        </p>
      </div>

      <div className="section-title">모니터 앰프</div>
      <div className="table-wrap">
        <table className="mtable">
          <thead>
            <tr>
              <th>번호</th>
              <th>어느 앰프</th>
              <th>기종</th>
              <th>위치</th>
            </tr>
          </thead>
          <tbody>
            {data.monitors.map(([aux, what, model, where]) => (
              <tr key={aux}>
                <td className="m-name">{aux}</td>
                <td>{what}</td>
                <td>{model}</td>
                <td className="dim">{where}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="section-title">{data.texts["map.volume.title"]}</div>
      <div className="card">
        {lines(data.texts["map.volume"]).map((l, i) => (
          <p key={i} className="guide-note">
            {md(l)}
          </p>
        ))}
      </div>
    </>
  );
}

/* ---------- 탭 3: 믹서·채널 ---------- */
function Mixer({ data }: { data: SoundGuideData }) {
  const t = data.texts;
  return (
    <>
      <Shot
        crop={[235, 60, 700, 605]}
        marks={[
          { x: (CX(1) + CX(8)) / 2, y: 410, w: 325, h: 420 },
          { x: CX(9), y: 410, w: 40, h: 420 },
        ]}
        labels={[
          { text: "1~8번 · 세로 한 줄이 채널 하나", x: 262, y: 185 },
          { text: "9/10 키보드", x: 578, y: 640 },
          { text: "오른쪽 구역 · 운영진만", x: 748, y: 350 },
          { text: "SUB1", x: 745, y: 520 },
        ]}
        caption={t["mixer.caption"]}
      />

      <div className="section-title">{t["mixer.channels.title"]}</div>
      <div className="table-wrap">
        <table className="mtable">
          <thead>
            <tr>
              <th>채널</th>
              <th>누가</th>
              <th>케이블</th>
              <th>메모</th>
            </tr>
          </thead>
          <tbody>
            {lines(t["mixer.channels"]).map((row, i) => {
              const [ch = "", who = "", cable = "", memo = ""] = row.split("|").map((c) => c.trim());
              return (
              <tr key={i}>
                <td className="m-name">{ch}</td>
                <td>{who}</td>
                <td>{cable}</td>
                <td className="dim">{memo}</td>
              </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div className="card mt-12">
        <p className="guide-note">{md(t["mixer.channels.note"])}</p>
      </div>

      <div className="section-title">{t["mixer.knobs.title"]}</div>
      <div className="card">
        <Steps text={t["mixer.knobs"]} />
        <p className="guide-note" style={{ marginTop: 12 }}>
          {md(t["mixer.knobs.note"])}
        </p>
      </div>

      <div className="section-title">{t["mixer.echo.title"]}</div>
      <div className="card">
        <p className="guide-note">{md(t["mixer.echo"])}</p>
      </div>
    </>
  );
}

/* ---------- 탭 4: 파트별 ---------- */
// 사진 예시 5개 — 좌표·라벨은 고정, 제목·설명은 texts parts.exN
const EXAMPLES: { chs: number[]; row: keyof typeof Y; label: string }[] = [
  { chs: [1, 2], row: "aux3", label: "AUX 3" },
  { chs: [7], row: "aux2", label: "AUX 2" },
  { chs: [8], row: "aux1", label: "AUX 1" },
  { chs: [9], row: "aux1", label: "AUX 1" },
  { chs: [1, 2], row: "fx", label: "AUX 4 / FX" },
];

function Parts({ data }: { data: SoundGuideData }) {
  const t = data.texts;
  return (
    <>
      <div className="card">
        <p className="guide-note">{md(t["parts.intro"])}</p>
      </div>
      {blocks(t["parts.list"]).map(([head, ...steps], i) => {
        const [name = "", tag = ""] = head.split("|").map((c) => c.trim());
        return (
          <details key={i} className="guide-part">
            <summary>
              <span>{name}</span>
              <span className="dim">{tag}</span>
            </summary>
            <ol className="guide-steps">
              {steps.map((s, j) => (
                <li key={j}>{md(s)}</li>
              ))}
            </ol>
          </details>
        );
      })}

      <div className="section-title">{t["parts.ex.title"]}</div>
      {EXAMPLES.map((ex, i) => (
        <AuxExample key={i} {...ex} title={t[`parts.ex${i + 1}.title`]} text={t[`parts.ex${i + 1}`]} />
      ))}
      <div className="card">
        <h4 className="guide-ex-title">{t["parts.bass.title"]}</h4>
        <p className="guide-note" style={{ marginBottom: 10 }}>
          {md(t["parts.bass.note"])}
        </p>
        <Shot
          crop={[420, 505, 385, 125]}
          marks={[
            { x: SUB_BTN_X(5), y: Y.sub12, r: 9 },
            { x: MASTER.sub1Fader.x, y: MASTER.sub1Fader.y, r: 18 },
          ]}
          labels={[
            { text: "5번 SUB 1-2 ON", x: SUB_BTN_X(5) + 14, y: Y.sub12 + 1 },
            { text: "SUB1 페이더", x: 800, y: 600, end: true },
          ]}
          caption={t["parts.bass.caption"]}
        />
      </div>
    </>
  );
}

/* ---------- 탭 5: 문제해결 ---------- */
function Trouble({ data }: { data: SoundGuideData }) {
  return (
    <div className="card">
      {blocks(data.texts["trouble"]).map(([q, ...a], i) => (
        <div className="guide-qa" key={i}>
          <h4>{q}</h4>
          <p>{md(a.join(" "))}</p>
        </div>
      ))}
    </div>
  );
}

export const PANES: ((p: { data: SoundGuideData }) => React.JSX.Element)[] = [QuickStart, StageMap, Mixer, Parts, Trouble];

export default function SoundGuide({ data }: { data: SoundGuideData }) {
  const [tab, setTab] = useState(0);
  // ?tab=0~4 로 특정 탭을 바로 열 수 있다 (QR · 공유 링크용)
  useEffect(() => {
    const t = Number(new URLSearchParams(window.location.search).get("tab"));
    if (t >= 0 && t < PANES.length) setTab(t);
  }, []);
  const Pane = PANES[tab];
  return (
    <>
      <div className="tab-row">
        {TABS.map((t, i) => (
          <button key={t} className={`tab${tab === i ? " active" : ""}`} onClick={() => setTab(i)}>
            {t}
          </button>
        ))}
      </div>
      <Pane data={data} />
      <div className="mt-12" style={{ textAlign: "center", padding: "8px 0 4px" }}>
        <Link href="/" className="section-link">
          기타투게더 앱 열기
        </Link>
      </div>
    </>
  );
}
