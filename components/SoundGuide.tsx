"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

// 음향 사용방법 — 탭 5개(빠른 시작 · 배치도 · 믹서 · 파트별 · 문제해결). 로그인 없이 공개(QR).
// 장비: Alto Live 1604 믹서 + 모니터 앰프 4대(AUX1·2·3, SUB1). 메인 스피커 없음.
// 사진(public/sound-guide/mixer.jpg, 1200x750 — Alto 공식 탑뷰) 위에 SVG로 표시를 그린다. 좌표는 사진 픽셀 기준.

const TABS = ["빠른 시작", "배치도", "믹서·채널", "파트별", "문제해결"] as const;

const CHANNELS: [string, string, string, string][] = [
  ["1", "보컬 (여)", "무선 마이크", "수신기 연결되어 있음 · 마이크 전원만 켜기"],
  ["2", "보컬 (남)", "무선 마이크", "수신기 연결되어 있음 · 마이크 전원만 켜기"],
  ["3", "예비", "통기타 (AG1)", "평소 미사용"],
  ["4", "예비", "통기타 (AG2)", "평소 미사용"],
  ["5", "베이스", "악기 케이블 (55)", "소리는 SUB1 베이스앰프로"],
  ["6", "드럼 (전자)", "악기 케이블 (55)", ""],
  ["7", "일렉기타 1 (EG1)", "악기 케이블 (55)", ""],
  ["8", "일렉기타 2 (EG2)", "악기 케이블 (55)", ""],
  ["9/10", "키보드", "스테레오 (L/R 2가닥)", ""],
  ["11/12", "미니앰프", "스테레오 (L/R 2가닥)", ""],
  ["13~16", "미사용", "", "꽂지 마세요"],
];

const MONITORS: [string, string, string, string][] = [
  ["AUX 1", "EG2 앞 모니터", "Acus (갈색 나무)", "일렉기타 2 자리"],
  ["AUX 2", "EG1 옆 모니터", "Acus (갈색 나무)", "일렉기타 1 자리"],
  ["AUX 3", "드럼 모니터", "Roland AC-33", "드럼 자리"],
  ["SUB 1", "베이스 앰프", "Cort CM", "베이스 소리만"],
  ["AUX 4 / FX", "에코(이펙트)", "믹서 내장", "스피커 아님"],
];

const T = ({ children }: { children: React.ReactNode }) => <b style={{ color: "var(--text)" }}>{children}</b>;

// 핵심 표: 행 = 키우고 싶은 소리(채널), 열 = 어느 스피커(AUX 번호). 칸 = 돌릴 노브.
const SPEAKERS: [string, string][] = [
  ["EG2 앞", "AUX 1"],
  ["EG1 옆", "AUX 2"],
  ["드럼", "AUX 3"],
  ["베이스앰프", "SUB 1"],
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

function KnobMatrix() {
  return (
    <>
      <div className="section-title">누구 소리를 어느 스피커에서 키울까</div>
      <div className="card" style={{ padding: "12px 16px" }}>
        <p className="guide-note" style={{ fontSize: 15, color: "var(--text)", fontWeight: 700 }}>
          그 악기 채널의 <span style={{ color: "var(--accent)" }}>스피커 번호 AUX 노브</span>를 올린다. 끝.
        </p>
        <p className="guide-note">예) 드러머가 보컬을 더 듣고 싶다 → 보컬 채널(1·2번)의 AUX 3 노브.</p>
        <p className="guide-note">
          <T>AUX 3(드럼 모니터)만 예외:</T> 그 채널의 <T>페이더가 올라가 있어야</T> 소리가 갑니다. AUX 1 · 2는 페이더와 상관없습니다.
        </p>
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
        <p className="guide-note">
          AUX 노브를 끝까지 올려도 스피커 전체가 작으면 <T>운영진에게 말해 주세요.</T> 스피커 전체 음량(AUX SEND 마스터)과 앰프 볼륨은
          운영진만 만집니다.
        </p>
      </div>
    </>
  );
}

/** 회원이 만져도 되는 곳 3군데 — 콘솔 전체 사진에 박스 표시 */
function AllowedShot() {
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
      caption="노란 박스 3곳만 만집니다. 나머지(GAIN · EQ · PAN · 오른쪽 마스터 구역 · MAIN)는 운영진이 맞춰 둔 것이라 손대지 않습니다."
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
function QuickStart() {
  return (
    <>
      <div className="card guide-intro">
        <p>우리 합주실엔 메인 스피커가 없습니다.</p>
        <p>모든 소리는 각 자리의 모니터 앰프 4대로만 나옵니다.</p>
        <p>
          그래서 믹서의 <T>MAIN 페이더는 올려도 소리가 나지 않습니다.</T>
        </p>
        <p>
          내 모니터에서 들리는 양은 <T>각 채널의 AUX 노브</T>로 조절합니다.
        </p>
      </div>

      <div className="section-title">켜기 순서</div>
      <div className="card">
        <ol className="guide-steps">
          <li>
            <b>벽 쪽 멀티탭 스위치 켜기</b>
          </li>
          <li>
            <b>믹서 전원 켜기</b> — 뒷면 POWER 스위치
          </li>
          <li>
            <b>앰프 전원 켜기</b> — 베이스앰프, 기타 모니터 2대, 드럼 모니터, 미니앰프. 앰프 볼륨 노브는 그대로 둡니다.
          </li>
          <li>
            <b>악기 꽂기</b> — 자기 채널에 케이블 연결. 보컬은 <b>무선 마이크 전원만 켜기</b>
          </li>
          <li>
            <b>내 채널 페이더 올리기</b> — 0 선(굵은 눈금)까지. 베이스는 SUB1 페이더도
          </li>
          <li>
            <b>내 모니터에서 소리 확인</b> — 안 들리면 아래 표에서 돌릴 노브 찾기
          </li>
        </ol>
      </div>

      <KnobMatrix />

      <div className="section-title">회원이 만지는 건 이 3가지뿐</div>
      <div className="card">
        <ol className="guide-steps">
          <li>
            <b>AUX 노브 (초록)</b> — "내 모니터에서 ○○ 소리를 키우고 싶다" → ○○ 채널의 <b>내 모니터 번호 AUX 노브</b>를 올립니다.
          </li>
          <li>
            <b>MUTE 버튼</b> — 빨간 불이 켜져 있으면 소리가 안 납니다. 소리가 안 나면 가장 먼저 확인하세요.
          </li>
          <li>
            <b>페이더(긴 슬라이더)</b> — 내 채널은 0 선 근처. 베이스는 SUB1 페이더도. 너무 내려가 있으면 어떤 노브를 돌려도 소리가
            작습니다.
          </li>
        </ol>
      </div>
      <AllowedShot />
      <Shot
        crop={[182, 195, 160, 290]}
        labels={[
          { text: "GAIN · 손대지 않음", x: 186, y: Y.gain + 1, lead: [CX(1) - 30, Y.gain, CX(1) - 12, Y.gain] },
          { text: "EQ · 손대지 않음", x: 186, y: 300, lead: [CX(1) - 30, 300, CX(1) - 12, 300] },
          { text: "AUX 1 → EG2 앞", x: 186, y: Y.aux1 + 1, lead: [CX(1) - 30, Y.aux1, CX(1) - 12, Y.aux1] },
          { text: "AUX 2 → EG1 옆", x: 186, y: Y.aux2 + 1, lead: [CX(1) - 30, Y.aux2, CX(1) - 12, Y.aux2] },
          { text: "AUX 3 → 드럼 (페이더↑)", x: 186, y: Y.aux3 + 1, lead: [CX(1) - 30, Y.aux3, CX(1) - 12, Y.aux3] },
          { text: "AUX 4 → 에코", x: 186, y: Y.fx + 1, lead: [CX(1) - 30, Y.fx, CX(1) - 12, Y.fx] },
          { text: "PAN · 손대지 않음", x: 186, y: Y.pan + 1, lead: [CX(1) - 30, Y.pan, CX(1) - 12, Y.pan] },
        ]}
        caption="채널 하나(1번 · 2번)를 위에서 아래로 본 모습. 초록 AUX 노브 4개만 만집니다. 모든 채널이 같은 순서입니다."
      />
      <Shot
        crop={[182, 480, 160, 150]}
        labels={[
          { text: "MUTE · 불 꺼짐", x: 186, y: Y.mute + 1, lead: [CX(1) - 30, Y.mute, CX(1) - 14, Y.mute] },
          { text: "SUB 1-2 · 베이스만 (운영진)", x: 186, y: Y.sub12 + 1, lead: [CX(1) - 30, Y.sub12, SUB_BTN_X(1) - 6, Y.sub12] },
          { text: "페이더 · 0 선까지", x: 186, y: 600, lead: [CX(1) - 30, 600, CX(1) - 10, Y.fader0 + 8] },
        ]}
      />

      <div className="section-title">끝낼 때 (켤 때의 반대 순서)</div>
      <div className="card">
        <ol className="guide-steps">
          <li>
            믹서 <b>채널 페이더와 SUB1 페이더를 모두 내립니다.</b>
          </li>
          <li>
            <b>앰프 4대 + 미니앰프 전원</b>을 끕니다.
          </li>
          <li>
            <b>믹서 전원</b>을 끕니다. 믹서를 먼저 끄면 앰프에서 "펑" 소리가 나며 스피커가 상할 수 있습니다.
          </li>
          <li>자기가 꽂은 악기 케이블만 뽑고, 무선 마이크는 전원을 끄고 제자리에 둡니다. 믹서에 꽂힌 케이블은 그대로 둡니다.</li>
        </ol>
      </div>

      <div className="section-title">손대지 마세요</div>
      <div className="card">
        <ol className="guide-steps">
          <li>
            <b>모니터 스피커(앰프) 위치 이동 금지</b> — 라벨 번호(AUX1 · AUX2 · AUX3 · SUB1)에 맞춰 자리와 방향이 잡혀 있습니다. 옮기면
            하울링이 나고 다른 자리에서 안 들립니다. 배치도 위치 그대로 두세요.
          </li>
          <li>
            <b>앰프 볼륨 노브 조정 금지</b> — 운영진이 맞춰 둔 위치 그대로. 모니터 음량은 믹서의 AUX 노브로만 조절합니다.
          </li>
          <li>
            <b>믹서에서 AUX · MUTE · 페이더 외 전부</b> — GAIN · EQ · PAN · 채널 작은 버튼들 · 오른쪽 마스터 구역(AUX SEND · FX · GRAPHIC
            EQ) · SUB2~4 · MAIN. 운영진이 맞춰 둔 세팅입니다.
          </li>
          <li>
            <b>PHANTOM(+48V)</b> — 뒷면 스위치. 앞면 빨간 PHANTOM 불이 켜져 있으면 운영진에게 알려 주세요.
          </li>
          <li>
            <b>믹서 뒷면 · 위쪽 단자에 꽂힌 케이블</b> — 뽑아 옮기지 않습니다.
          </li>
        </ol>
      </div>
    </>
  );
}

/* ---------- 탭 2: 배치도 ---------- */
function StageMap() {
  return (
    <>
      <div className="card">
        <svg className="guide-map" viewBox="150 30 810 520" role="img" aria-label="합주실 배치도">
          <rect className="wall" x="160" y="40" width="790" height="500" rx="16" />

          <rect className="amp" x="266" y="68" width="110" height="70" rx="10" />
          <text x="321" y="94">SUB1</text>
          <text className="sub" x="321" y="120">
            베이스앰프
          </text>

          <rect className="amp" x="526" y="56" width="110" height="70" rx="10" />
          <text x="581" y="82">AUX3</text>
          <text className="sub" x="581" y="108">
            드럼 모니터
          </text>

          <rect className="amp" x="161" y="300" width="110" height="70" rx="10" />
          <text x="216" y="326">AUX1</text>
          <text className="sub" x="216" y="352">
            EG2 모니터
          </text>

          <rect className="amp" x="832" y="376" width="110" height="70" rx="10" />
          <text x="887" y="402">AUX2</text>
          <text className="sub" x="887" y="428">
            EG1 모니터
          </text>

          <ellipse className="player" cx="673" cy="175" rx="60" ry="32" />
          <text x="673" y="175">드럼</text>

          <ellipse className="player" cx="485" cy="232" rx="46" ry="30" />
          <text x="485" y="232">베이스</text>

          <ellipse className="player" cx="360" cy="340" rx="46" ry="30" />
          <text x="360" y="340">EG2</text>

          <rect className="player" x="686" y="297" width="140" height="44" rx="8" />
          <text x="756" y="319">키보드</text>

          <ellipse className="player" cx="551" cy="438" rx="46" ry="30" />
          <text x="551" y="438">보컬</text>

          <ellipse className="player" cx="742" cy="493" rx="46" ry="30" />
          <text x="742" y="493">EG1</text>
        </svg>
        <p className="guide-note" style={{ marginTop: 10 }}>
          노란 테두리가 앰프(모니터), 회색이 연주자 자리입니다. 앰프에 붙은 GUITAR TOGETHER 라벨(AUX1 · AUX2 · AUX3 · SUB1)과 믹서
          노브 번호가 같습니다. <T>앰프 위치와 방향은 옮기지 마세요.</T>
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
            {MONITORS.map(([aux, what, model, where]) => (
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

      <div className="section-title">모니터 전체 음량</div>
      <div className="card">
        <p className="guide-note">
          스피커 하나의 <T>전체 음량</T>(믹서 오른쪽 AUX SEND 마스터)과 <T>앰프 본체 볼륨</T>은 운영진만 만집니다. AUX 노브를 올려도
          부족하면 운영진에게 말해 주세요.
        </p>
        <p className="guide-note">
          <T>베이스</T>는 AUX가 아니라 <T>SUB1 페이더</T>로 베이스 앰프 음량을 조절합니다.
        </p>
      </div>
    </>
  );
}

/* ---------- 탭 3: 믹서·채널 ---------- */
function Mixer() {
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
        caption="콘솔 전체(Alto Live 1604). 왼쪽부터 1번 보컬(여) · 2번 보컬(남) · 3 · 4 예비 · 5 베이스 · 6 드럼 · 7 EG1 · 8 EG2 · 9/10 키보드 · 11/12 미니앰프."
      />

      <div className="section-title">채널 연결표</div>
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
            {CHANNELS.map(([ch, who, cable, memo]) => (
              <tr key={ch}>
                <td className="m-name">{ch}</td>
                <td>{who}</td>
                <td>{cable}</td>
                <td className="dim">{memo}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="card mt-12">
        <p className="guide-note">
          꽂혀 있는 케이블은 뽑아 옮기지 말고, 자기 자리 채널에만 연결하세요. 보컬 무선 마이크 수신기는 1 · 2번에 연결되어 있으니 마이크
          전원만 켜면 됩니다.
        </p>
      </div>

      <div className="section-title">채널에서 만지는 곳 (위에서 아래 순서)</div>
      <div className="card">
        <ol className="guide-steps">
          <li>
            <b>AUX 1 · 2 · 3 (초록 노브)</b> — 내 소리를 어느 모니터로 얼마나 보낼지. AUX 1 = EG2 앞, AUX 2 = EG1 옆, AUX 3 = 드럼.
            9시에서 시작해 필요한 만큼 올립니다. <b>AUX 3은 그 채널 페이더가 올라가 있어야</b> 소리가 갑니다.
          </li>
          <li>
            <b>AUX 4 / FX</b> — 보컬 에코 양. 보컬 채널(1 · 2)에서만 사용합니다.
          </li>
          <li>
            <b>MUTE</b> — 빨간 불이 꺼져 있어야 소리가 납니다.
          </li>
          <li>
            <b>페이더</b> — 0 선(굵은 눈금) 근처. 합주 중 내 전체 음량은 페이더로, 모니터별 음량은 AUX 노브로.
          </li>
        </ol>
        <p className="guide-note" style={{ marginTop: 12 }}>
          그 위의 <T>GAIN · EQ(파란 노브) · PAN</T>과 작은 버튼들은 운영진이 맞춰 둔 세팅입니다. 손대지 않습니다.
        </p>
      </div>

      <div className="section-title">보컬 에코</div>
      <div className="card">
        <p className="guide-note">
          에코 양은 <T>보컬 채널(1 · 2)의 AUX 4 / FX 노브</T>로 조절합니다. 9시~12시 사이가 적당하고, 오른쪽으로 돌릴수록 에코가
          많아집니다. 믹서 오른쪽 <T>FX 프리셋 번호 노브</T>는 건드리지 마세요. 에코가 전혀 안 들리거나 이상한 효과로 바뀝니다.
        </p>
      </div>
    </>
  );
}

/* ---------- 탭 4: 파트별 ---------- */
const PARTS: { name: string; tag: string; steps: React.ReactNode[] }[] = [
  {
    name: "보컬",
    tag: "무선 마이크 · 여 1번 · 남 2번 · 에코 AUX 4",
    steps: [
      <>
        <b>무선 마이크 전원</b>을 켭니다. 여성 보컬 마이크가 <b>1번</b>, 남성 보컬 마이크가 <b>2번</b> 채널입니다. 수신기는 이미 연결되어
        있습니다.
      </>,
      <>
        MUTE 불이 꺼져 있는지 확인하고 <b>페이더를 0 선</b>까지 올립니다.
      </>,
      <>
        내 목소리가 들려야 하는 모니터의 AUX 노브를 올립니다. EG2 앞 모니터 = <b>AUX 1</b>, EG1 옆 모니터 = <b>AUX 2</b>, 드럼 모니터
        = <b>AUX 3</b>.
      </>,
      <>
        에코는 <b>AUX 4 / FX 노브</b>를 9시~12시 사이로. 삐~ 소리가 나면 마이크를 모니터 반대쪽으로 돌리고 AUX 노브를 조금 내립니다.
      </>,
    ],
  },
  {
    name: "일렉기타",
    tag: "EG1 7번 → AUX 2 · EG2 8번 → AUX 1",
    steps: [
      <>
        EG1은 <b>7번</b>, EG2는 <b>8번</b> 채널입니다. 꽂혀 있는 케이블을 그대로 쓰세요.
      </>,
      <>
        내 소리 키우기: EG1 연주자는 <b>7번 채널의 AUX 2</b>, EG2 연주자는 <b>8번 채널의 AUX 1</b> 노브를 올립니다.
      </>,
      <>
        상대 기타·보컬을 내 모니터로 더 듣고 싶으면 <b>그 채널의 내 모니터 번호 AUX 노브</b>를 살짝 올립니다.
      </>,
      <>앰프(Acus) 본체 볼륨은 건드리지 않습니다. 음색은 이펙터·기타에서 조절하세요.</>,
    ],
  },
  {
    name: "베이스",
    tag: "5번 → SUB 1 베이스앰프",
    steps: [
      <>
        <b>5번</b> 채널입니다. 다른 파트와 달리 AUX가 아니라 <b>SUB 1</b>로 베이스 앰프(Cort)에 바로 갑니다.
      </>,
      <>
        5번 채널의 <b>SUB 1-2 버튼</b>이 눌려 있는지 확인합니다. 튀어나와 있으면 소리가 전혀 나지 않습니다.
      </>,
      <>
        5번 페이더를 0 선까지 올리고, 믹서 오른쪽의 <b>SUB 1 페이더</b>로 베이스 앰프 음량을 맞춥니다.
      </>,
      <>
        드러머나 기타가 베이스를 더 듣고 싶어하면 5번 채널의 <b>AUX 1 · 2 · 3</b>을 살짝 올려 줍니다.
      </>,
    ],
  },
  {
    name: "드럼 (전자)",
    tag: "6번 → AUX 3 Roland 앰프",
    steps: [
      <>
        드럼 모듈 출력이 <b>6번</b> 채널에 연결되어 있습니다.
      </>,
      <>
        내 드럼 소리 키우기: <b>6번 채널의 AUX 3</b> 노브를 올립니다.
      </>,
      <>
        보컬·베이스·키보드를 더 듣고 싶으면 <b>그 채널(1 · 2 · 5 · 9/10)의 AUX 3</b> 노브를 올립니다. 그 채널 <b>페이더가 올라가
        있어야</b> AUX 3으로 소리가 갑니다.
      </>,
    ],
  },
  {
    name: "키보드",
    tag: "9/10번 스테레오",
    steps: [
      <>
        키보드 L/R 출력이 <b>9/10번</b> 스테레오 채널에 연결되어 있습니다.
      </>,
      <>
        9/10번 페이더를 0 선까지 올리고, 모두가 들을 수 있게 <b>AUX 1 · 2 · 3</b>을 고르게(11시~12시) 올립니다.
      </>,
    ],
  },
];

function Parts() {
  return (
    <>
      <div className="card">
        <p className="guide-note">내 파트를 누르면 조절 순서가 펼쳐집니다. 아래에는 자주 묻는 상황을 사진으로 표시했습니다.</p>
      </div>
      {PARTS.map((p) => (
        <details key={p.name} className="guide-part">
          <summary>
            <span>{p.name}</span>
            <span className="dim">{p.tag}</span>
          </summary>
          <ol className="guide-steps">
            {p.steps.map((s, i) => (
              <li key={i}>{s}</li>
            ))}
          </ol>
        </details>
      ))}

      <div className="section-title">이럴 땐 이 노브 (사진 예시)</div>
      <AuxExample
        chs={[1, 2]}
        row="aux3"
        title="드러머: 보컬이 안 들려요"
        text="보컬 채널 1 · 2번의 AUX 3 노브를 올립니다. 드럼 모니터(AUX3 · Roland)에서 보컬이 커집니다. 보컬 채널 페이더가 올라가 있어야 합니다."
        label="AUX 3"
      />
      <AuxExample
        chs={[7]}
        row="aux2"
        title="EG1: 내 기타 소리를 키우고 싶어요"
        text="7번 채널의 AUX 2 노브를 올립니다. 내 옆 모니터(AUX2 · Acus)에서 내 기타가 커집니다."
        label="AUX 2"
      />
      <AuxExample
        chs={[8]}
        row="aux1"
        title="EG2: 내 기타 소리를 키우고 싶어요"
        text="8번 채널의 AUX 1 노브를 올립니다. 내 앞 모니터(AUX1 · Acus)에서 내 기타가 커집니다."
        label="AUX 1"
      />
      <AuxExample
        chs={[9]}
        row="aux1"
        title="EG2: 키보드를 더 듣고 싶어요"
        text="9/10번(키보드) 채널의 AUX 1 노브를 올립니다. 다른 사람 소리도 같은 방법 — 그 사람 채널의 내 모니터 번호 AUX."
        label="AUX 1"
      />
      <AuxExample
        chs={[1, 2]}
        row="fx"
        title="보컬: 에코를 더 / 덜"
        text="보컬 채널 1 · 2번의 맨 아래 초록 노브(AUX 4 / FX)를 오른쪽으로 돌리면 에코가 많아지고, 왼쪽으로 돌리면 줄어듭니다."
        label="AUX 4 / FX"
      />
      <div className="card">
        <h4 className="guide-ex-title">베이스: 베이스 앰프 소리를 키우고 싶어요</h4>
        <p className="guide-note" style={{ marginBottom: 10 }}>
          SUB 1-2 버튼은 운영진이 눌러 둔 상태입니다. 회원은 <T>SUB1 페이더</T>만 올립니다.
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
          caption="5번 채널의 SUB 1-2 버튼이 눌려 있는 상태에서, 오른쪽 SUB1 페이더를 올립니다. AUX 노브는 베이스 앰프와 상관없습니다."
        />
      </div>
    </>
  );
}

/* ---------- 탭 5: 문제해결 ---------- */
const QA: [string, string][] = [
  [
    "소리가 아예 안 나요",
    "순서대로 확인합니다. 해당 채널 MUTE 불이 꺼져 있는지 → 페이더가 올라가 있는지 → 내 모니터 번호의 AUX 노브가 0은 아닌지 → 앰프 전원 불이 들어와 있는지 → 악기 볼륨 · 케이블을 끝까지 꽂았는지 → 케이블을 다른 것으로 바꿔보기.",
  ],
  [
    "드럼 모니터(AUX 3)에서만 안 나요",
    "AUX 3은 그 채널 페이더가 내려가 있으면 소리가 가지 않습니다. 듣고 싶은 악기 채널의 페이더를 0 선까지 올린 뒤 AUX 3 노브를 보세요.",
  ],
  [
    "보컬 마이크만 안 나요",
    "무선 마이크 전원이 켜져 있는지, 배터리가 남아 있는지 먼저 봅니다. 그다음 수신기 전원 불, 1 · 2번 채널 MUTE와 페이더, 내 모니터 AUX 노브 순서로 확인합니다.",
  ],
  [
    "베이스 소리만 안 나요",
    "5번 채널의 SUB 1-2 버튼이 눌려 있는지 가장 먼저 봅니다. 그다음 믹서 오른쪽 SUB 1 페이더가 올라가 있는지, 베이스 앰프(Cort) 전원이 켜져 있는지 확인합니다.",
  ],
  [
    "삐~ 하울링이 나요",
    "마이크가 모니터 앰프를 향하고 있지 않은지 먼저 보세요. 그다음 보컬 채널의 AUX 노브를 조금 내립니다. 마이크 머리 부분을 손으로 감싸 쥐지 마세요. 그래도 계속 나면 운영진에게 말해 주세요.",
  ],
  [
    "에코가 안 나거나 너무 심해요",
    "보컬 채널(1 · 2)의 AUX 4 / FX 노브를 봅니다. 안 나면 12시 방향으로, 심하면 9시 이하로 내립니다. 오른쪽 FX 프리셋 노브는 건드리지 마세요.",
  ],
  ["지직거리거나 뚝뚝 끊겨요", "케이블 접촉 불량이 대부분입니다. 플러그를 뺐다 다시 꽂거나 다른 케이블로 바꿔보세요."],
  ["소리가 찢어져요", "악기 볼륨과 내 채널 페이더를 조금 내려 보세요. 그래도 찢어지면 운영진에게 말해 주세요. GAIN은 운영진만 만집니다."],
  [
    "그래도 안 되면",
    "내 채널 페이더를 내리고 운영진에게 연락하세요. AUX · MUTE · 페이더 외의 노브를 돌리면 다음 팀이 더 고생합니다.",
  ],
];

function Trouble() {
  return (
    <div className="card">
      {QA.map(([q, a]) => (
        <div className="guide-qa" key={q}>
          <h4>{q}</h4>
          <p>{a}</p>
        </div>
      ))}
    </div>
  );
}

const PANES = [QuickStart, StageMap, Mixer, Parts, Trouble];

export default function SoundGuide() {
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
      <Pane />
      <div className="mt-12" style={{ textAlign: "center", padding: "8px 0 4px" }}>
        <Link href="/" className="section-link">
          기타투게더 앱 열기
        </Link>
      </div>
    </>
  );
}
