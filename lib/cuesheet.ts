// 큐시트 — 공연 리허설 때 팀별 믹서(Alto Live 1604)·개인 이펙터 세팅 기록. 서버/클라이언트 공용.
// 저장: app_settings(key='cuesheet:<uuid>', value=Cuesheet). 모니터·메인 앰프 볼륨은 고정이라 기록하지 않는다.

export type ChKey =
  | "gain" | "comp" | "hi" | "midf" | "mid" | "low"
  | "aux1" | "aux2" | "aux3" | "aux4" | "pan" | "mute" | "fader";
export type ChRow = { name: string } & Record<ChKey, string>;
export type MasterKey = "aux1" | "aux2" | "aux3" | "aux4" | "sub1" | "sub2" | "sub3" | "sub4" | "main";
export type Master = Record<MasterKey, string> & { fxPreset: string };
export type FxRow = { part: string; gear: string; vol: string; memo: string };
export type TeamCue = { ch: ChRow[]; master: Master; fx: FxRow[] };
export type Cuesheet = { title: string; date: string; teams: Record<string, TeamCue> };

/** 시계 방향 7시~5시, 30분 단위 (노브) */
export const KNOB = ["7", "7:30", "8", "8:30", "9", "9:30", "10", "10:30", "11", "11:30", "12",
  "12:30", "1", "1:30", "2", "2:30", "3", "3:30", "4", "4:30", "5"];
export const PAN = ["L", "8", "9", "10", "11", "C", "1", "2", "3", "4", "R"];
/** 페이더 dB — 실제로 많이 쓰는 0 근처를 촘촘히 */
export const FADER = ["∞", "-40", "-30", "-20", "-15", "-10", "-7", "-5", "-3", "-2", "-1", "0", "+1", "+2", "+3", "+5", "+7", "+10"];

export type Col = { key: ChKey; label: string; options: string[] | "toggle"; center?: string };
export const CH_COLS: Col[] = [
  { key: "gain", label: "Gain", options: KNOB },
  { key: "comp", label: "Comp", options: KNOB },
  { key: "hi", label: "Hi", options: KNOB, center: "12" },
  { key: "midf", label: "Mid Hz", options: KNOB },
  { key: "mid", label: "Mid", options: KNOB, center: "12" },
  { key: "low", label: "Low", options: KNOB, center: "12" },
  { key: "aux1", label: "AUX1", options: KNOB },
  { key: "aux2", label: "AUX2", options: KNOB },
  { key: "aux3", label: "AUX3", options: KNOB },
  { key: "aux4", label: "AUX4/FX", options: KNOB },
  { key: "pan", label: "Pan", options: PAN, center: "C" },
  { key: "mute", label: "Mute", options: "toggle" },
  { key: "fader", label: "페이더", options: FADER, center: "0" },
];
export const MASTER_COLS: { key: MasterKey; label: string; options: string[]; center?: string }[] = [
  { key: "aux1", label: "AUX1", options: KNOB },
  { key: "aux2", label: "AUX2", options: KNOB },
  { key: "aux3", label: "AUX3", options: KNOB },
  { key: "aux4", label: "AUX4", options: KNOB },
  { key: "sub1", label: "SUB1", options: FADER, center: "0" },
  { key: "sub2", label: "SUB2", options: FADER, center: "0" },
  { key: "sub3", label: "SUB3", options: FADER, center: "0" },
  { key: "sub4", label: "SUB4", options: FADER, center: "0" },
  { key: "main", label: "MAIN", options: FADER, center: "0" },
];

const CH_KEYS = CH_COLS.map((c) => c.key);
const MASTER_KEYS = MASTER_COLS.map((c) => c.key);
// 음향 사용방법 '채널 연결표' 기준 (lib/sound-guide-texts.ts mixer.channels)
const DEFAULT_CH = ["1 보컬(여)", "2 보컬(남)", "3 AG1", "4 AG2", "5 베이스", "6 드럼", "7 EG1", "8 EG2", "9/10 키보드", "11/12 미니앰프"];
const DEFAULT_FX = ["EG1", "EG2", "베이스", "키보드"];

const blankCh = (name: string): ChRow =>
  ({ name, ...Object.fromEntries(CH_KEYS.map((k) => [k, ""])) }) as ChRow;
export const blankFx = (part = ""): FxRow => ({ part, gear: "", vol: "", memo: "" });
export const defaultTeamCue = (): TeamCue => ({
  ch: DEFAULT_CH.map(blankCh),
  master: { ...(Object.fromEntries(MASTER_KEYS.map((k) => [k, ""])) as Record<MasterKey, string>), fxPreset: "" },
  fx: DEFAULT_FX.map(blankFx),
});

/** 이름·파트 말고 값이 하나라도 기록돼 있는지 (복사 덮어쓰기 확인용) */
export const hasValues = (t: TeamCue) =>
  t.ch.some((r) => CH_KEYS.some((k) => r[k])) ||
  Object.values(t.master).some(Boolean) ||
  t.fx.some((f) => f.gear || f.vol || f.memo);

export const isCueId = (id: unknown): id is string =>
  typeof id === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(id);

export const MAX_CELL = 20;
export const MAX_MEMO = 60;
const MAX_CH = 16;
const MAX_FX = 12;

const str = (v: unknown, max: number) => (typeof v === "string" && v.length <= max ? v.trim() : null);

/** 팀 한 장 검증 — 한 칸이라도 틀리면 null (잘못된 데이터를 DB에 넣지 않는다) */
export function normalizeTeamCue(input: unknown): TeamCue | null {
  const o = (input && typeof input === "object" ? input : null) as Record<string, unknown> | null;
  if (!o || !Array.isArray(o.ch) || !Array.isArray(o.fx) || o.ch.length > MAX_CH || o.fx.length > MAX_FX) return null;
  const ch: ChRow[] = [];
  for (const raw of o.ch) {
    const r = (raw ?? {}) as Record<string, unknown>;
    const row = { name: str(r.name, MAX_CELL) } as Record<string, string | null>;
    for (const k of CH_KEYS) row[k] = str(r[k] ?? "", MAX_CELL);
    if (Object.values(row).some((v) => v == null)) return null;
    ch.push(row as ChRow);
  }
  const m = (o.master ?? {}) as Record<string, unknown>;
  const master = { fxPreset: str(m.fxPreset ?? "", MAX_CELL) } as Record<string, string | null>;
  for (const k of MASTER_KEYS) master[k] = str(m[k] ?? "", MAX_CELL);
  if (Object.values(master).some((v) => v == null)) return null;
  const fx: FxRow[] = [];
  for (const raw of o.fx) {
    const r = (raw ?? {}) as Record<string, unknown>;
    const row = { part: str(r.part, MAX_CELL), gear: str(r.gear, MAX_CELL), vol: str(r.vol, MAX_CELL), memo: str(r.memo, MAX_MEMO) };
    if (Object.values(row).some((v) => v == null)) return null;
    fx.push(row as FxRow);
  }
  return { ch, master: master as Master, fx };
}

/** 로드 시 정리 — 틀린 팀만 버린다(그 팀은 기본표로 보임) */
export function normalizeCuesheetLoose(input: unknown): Cuesheet {
  const o = (input && typeof input === "object" ? input : {}) as Record<string, unknown>;
  const teams: Record<string, TeamCue> = {};
  const rawTeams = (o.teams && typeof o.teams === "object" ? o.teams : {}) as Record<string, unknown>;
  for (const [id, t] of Object.entries(rawTeams)) {
    const n = normalizeTeamCue(t);
    if (n) teams[id] = n;
  }
  return { title: str(o.title, 60) ?? "", date: str(o.date, 10) ?? "", teams };
}

/** 노브 각도(도) — 12시=0, 시계방향 +. 7시=-150 · 5시=+150. Pan의 L/C/R 포함. 값 없음/모름=null */
export function knobAngle(v: string): number | null {
  if (v === "L") return -150;
  if (v === "C") return 0;
  if (v === "R") return 150;
  const m = /^(\d{1,2})(?::(\d{2}))?$/.exec(v);
  if (!m) return null;
  let h = Number(m[1]) + Number(m[2] ?? 0) / 60;
  if (h < 7) h += 12; // 1시~5시 → 13~17
  if (h < 7 || h > 17) return null;
  return (h - 12) * 30;
}

/** 믹서 페이더 눈금 (위치 0=맨 아래 ∞, 1=맨 위 +10). 0dB가 위쪽 1/4 지점인 실제 페이더 간격 */
export const FADER_MARKS: [string, number][] = [
  ["+10", 1], ["+5", 0.87], ["0", 0.74], ["-5", 0.61], ["-10", 0.48],
  ["-20", 0.33], ["-30", 0.2], ["-40", 0.1], ["∞", 0],
];
/** dB 값 → 페이더 위치(0~1). 눈금 사이는 선형 보간. 값 없음=null */
export function faderPos(v: string): number | null {
  if (v === "∞") return 0;
  const db = Number(v);
  if (!v || !Number.isFinite(db)) return null;
  for (let i = 0; i < FADER_MARKS.length - 2; i++) {
    const [a, pa] = FADER_MARKS[i];
    const [b, pb] = FADER_MARKS[i + 1];
    if (db <= Number(a) && db >= Number(b)) return pb + ((db - Number(b)) / (Number(a) - Number(b))) * (pa - pb);
  }
  return db > 10 ? 1 : 0.1 * Math.max(0, (db + 60) / 20); // -40 아래는 ∞ 쪽으로
}
