// 음향 사용방법 — 운영진이 편집하는 부분(배치도 · 모니터 앰프 표). 서버/클라이언트 공용.
// 저장: app_settings(key='sound_guide', value jsonb). 없으면 DEFAULT 사용.

import { DEFAULT_TEXTS, TEXT_FIELDS } from "./sound-guide-texts";

export type MapItem = {
  id: string;
  kind: "amp" | "player";
  shape: "rect" | "ellipse";
  x: number; // 중심 좌표 (SVG viewBox 150 30 810 520 기준)
  y: number;
  w: number;
  h: number;
  label: string;
  sub?: string;
};

export type SoundGuideData = {
  items: MapItem[];
  monitors: [string, string, string, string][]; // 번호 · 어느 앰프 · 기종 · 위치
  texts: Record<string, string>; // 문장 (키 = lib/sound-guide-texts TEXT_FIELDS)
};

export const MAP_VIEWBOX = { x: 150, y: 30, w: 810, h: 520 };

const amp = (id: string, x: number, y: number, label: string, sub: string): MapItem => ({
  id, kind: "amp", shape: "rect", x, y, w: 110, h: 70, label, sub,
});
const player = (id: string, x: number, y: number, label: string, w = 92, h = 60, shape: MapItem["shape"] = "ellipse"): MapItem => ({
  id, kind: "player", shape, x, y, w, h, label,
});

export const DEFAULT_SOUND_GUIDE: SoundGuideData = {
  items: [
    amp("sub1", 321, 103, "SUB1", "모니터 4"),
    amp("aux3", 581, 91, "AUX3", "모니터 3"),
    amp("aux1", 216, 335, "AUX1", "모니터 1"),
    amp("aux2", 887, 411, "AUX2", "모니터 2"),
    player("drum", 673, 175, "드럼", 120, 64),
    player("bass", 485, 232, "베이스"),
    player("eg2", 360, 340, "EG2"),
    player("key", 756, 319, "키보드", 140, 44, "rect"),
    player("vocal", 551, 438, "보컬"),
    player("eg1", 742, 493, "EG1"),
  ],
  monitors: [
    ["AUX 1", "모니터 1", "Acus (갈색 나무)", "일렉기타 2 자리"],
    ["AUX 2", "모니터 2", "Acus (갈색 나무)", "일렉기타 1 자리"],
    ["AUX 3", "모니터 3", "Roland AC-33", "드럼 자리"],
    ["SUB 1", "모니터 4", "Cort CM", "베이스 소리만"],
    ["AUX 4 / FX", "에코(이펙트)", "믹서 내장", "스피커 아님"],
  ],
  texts: DEFAULT_TEXTS,
};

const str = (v: unknown, max: number) => (typeof v === "string" && v.length <= max ? v.trim() : null);
const num = (v: unknown, lo: number, hi: number) =>
  typeof v === "number" && Number.isFinite(v) && v >= lo && v <= hi ? Math.round(v) : null;

export const MAX_ITEMS = 30;
export const MAX_MONITORS = 10;
export const MAX_TEXT = 6000;

function normItems(raw: unknown): MapItem[] | null {
  if (!Array.isArray(raw) || raw.length > MAX_ITEMS) return null;
  const items: MapItem[] = [];
  for (const it of raw) {
    const r = (it ?? {}) as Record<string, unknown>;
    const id = str(r.id, 40);
    const label = str(r.label, 20);
    const sub = r.sub == null ? undefined : str(r.sub, 20);
    const x = num(r.x, 0, 1200), y = num(r.y, 0, 800), w = num(r.w, 20, 400), h = num(r.h, 20, 300);
    if (!id || label == null || sub === null || x == null || y == null || w == null || h == null) return null;
    if (r.kind !== "amp" && r.kind !== "player") return null;
    if (r.shape !== "rect" && r.shape !== "ellipse") return null;
    items.push({ id, kind: r.kind, shape: r.shape, x, y, w, h, label, ...(sub ? { sub } : {}) });
  }
  return items;
}

function normMonitors(raw: unknown): SoundGuideData["monitors"] | null {
  if (!Array.isArray(raw) || raw.length > MAX_MONITORS) return null;
  const monitors: SoundGuideData["monitors"] = [];
  for (const row of raw) {
    if (!Array.isArray(row) || row.length !== 4) return null;
    const cells = row.map((c) => str(c, 40));
    if (cells.some((c) => c == null)) return null;
    monitors.push(cells as [string, string, string, string]);
  }
  return monitors;
}

/** texts: 아는 키만. 없는 키는 기본 문장(옛 저장본 호환). 잘못된 값은 strict면 전체 실패, 아니면 그 키만 기본값 */
function normTexts(raw: unknown, strict: boolean): Record<string, string> | null {
  const src = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const texts: Record<string, string> = {};
  for (const f of TEXT_FIELDS) {
    const v = src[f.key];
    if (typeof v === "string" && v.length <= MAX_TEXT) texts[f.key] = v;
    else if (v === undefined || !strict) texts[f.key] = DEFAULT_TEXTS[f.key];
    else return null;
  }
  return texts;
}

/** 저장 시 검증 — 한 곳이라도 틀리면 null (잘못된 데이터를 DB에 넣지 않는다) */
export function normalizeSoundGuide(input: unknown): SoundGuideData | null {
  if (!input || typeof input !== "object") return null;
  const o = input as Record<string, unknown>;
  const items = normItems(o.items);
  const monitors = normMonitors(o.monitors);
  const texts = normTexts(o.texts, true);
  if (!items || !monitors || !texts) return null;
  return { items, monitors, texts };
}

/** 로드 시 정리 — 틀린 구역만 기본값으로 (한 칸 때문에 저장본 전체를 버리지 않는다) */
export function normalizeSoundGuideLoose(input: unknown): SoundGuideData {
  const o = (input && typeof input === "object" ? input : {}) as Record<string, unknown>;
  return {
    items: normItems(o.items) ?? DEFAULT_SOUND_GUIDE.items,
    monitors: normMonitors(o.monitors) ?? DEFAULT_SOUND_GUIDE.monitors,
    texts: normTexts(o.texts, false) ?? DEFAULT_TEXTS,
  };
}
