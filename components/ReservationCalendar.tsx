"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { Reservation } from "@/lib/types";
import { getSupabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth";
import { can } from "@/lib/roles";
import { kstParts } from "@/lib/date";
import { useRefreshHold } from "@/lib/refresh-hold";
import { useSyncedState } from "@/lib/use-synced-state";

const DOW = ["일", "월", "화", "수", "목", "금", "토"];
const pad = (n: number) => String(n).padStart(2, "0");
const ymd = (y: number, m: number, d: number) => `${y}-${pad(m + 1)}-${pad(d)}`;

// 시작/종료 시간 선택용 (시 09~23, 분 10분 단위)
const HOURS = Array.from({ length: 15 }, (_, i) => 9 + i); // 9..23
const MINUTES = [0, 10, 20, 30, 40, 50];

// 용도(운영진 전용) — 레슨/정기공연/MT/운영진회의/리허설(음향체크)/중간점검/재롱페스티벌
const OP_PURPOSES = [
  "레슨",
  "정기공연",
  "MT",
  "운영진회의",
  "리허설(음향체크)",
  "중간점검",
  "재롱페스티벌",
];
// 캘린더에 빨간 점으로 표시하는 용도 (공연·행사 계열)
const RED_DOT_PURPOSES = ["정기공연", "리허설(음향체크)", "중간점검", "재롱페스티벌"];
// MT 처럼 여러 날에 걸치는(기간) 용도
const MULTI_DAY_PURPOSE = "MT";

// "HH:MM - HH:MM" → [시작분, 끝분]
const parseRange = (label: string): [number, number] | null => {
  const m = label.match(/(\d{1,2}):(\d{2})\s*-\s*(\d{1,2}):(\d{2})/);
  if (!m) return null;
  return [Number(m[1]) * 60 + Number(m[2]), Number(m[3]) * 60 + Number(m[4])];
};

// 두 시간대가 겹치는지
const overlaps = (a: [number, number] | null, b: [number, number] | null) =>
  !!a && !!b && a[0] < b[1] && b[0] < a[1];

// YYYY-MM-DD 문자열 날짜 헬퍼 (로컬 자정 기준 — 화면 표시용, TZ 안전한 문자열 비교 위주)
const parseYmd = (s: string) => {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d);
};
const addDaysStr = (s: string, n: number) => {
  const d = parseYmd(s);
  d.setDate(d.getDate() + n);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};
const diffDays = (a: string, b: string) =>
  Math.round((parseYmd(b).getTime() - parseYmd(a).getTime()) / 86400000);
const nightsLabelOf = (start: string, end: string) => {
  const n = diffDays(start, end);
  return n > 0 ? `${n}박${n + 1}일` : "";
};
const mdLabel = (s: string) => {
  const [, m, d] = s.split("-");
  return `${Number(m)}월 ${Number(d)}일`;
};

// 예약이 특정 날짜를 포함하는지 (MT 등 기간 예약은 시작~종료 사이 모든 날 포함)
const spans = (r: Reservation, dateStr: string) =>
  r.end_date && r.end_date > r.date
    ? r.date <= dateStr && dateStr <= r.end_date
    : r.date === dateStr;

// 용도 → 캘린더 점 색상 클래스 (""=앰버 기본)
const dotClassFor = (purpose: string) =>
  RED_DOT_PURPOSES.includes(purpose)
    ? "perf" // 빨강 (정기공연/리허설/중간점검/재롱페스티벌)
    : purpose === "MT"
      ? "mt" // 초록
      : purpose === "운영진회의"
        ? "meeting" // 파랑
        : ""; // 앰버 (합주/개인연습/레슨)
// 점 표시 순서(색상별)
const DOT_ORDER = ["perf", "mt", "meeting", ""];

export default function ReservationCalendar({
  initial,
  myTeamNames,
}: {
  initial: Reservation[];
  myTeamNames: string[];
}) {
  const { user } = useAuth();
  const router = useRouter();
  const canManage = can.manageReservations(user?.role);
  const myName = user?.name ?? "나";
  // 예약자 선택지: 본인 이름 + 소속 팀명(최대 2개). 팀 없으면 개인 이름만.
  const reserverOptions = [myName, ...myTeamNames];
  // 팀 배정 시 기본 예약자 = 첫 팀 (개인연습 체크 시에만 개인 이름)
  const defaultReserver = myTeamNames[0] ?? myName;

  // 오늘 = 한국시간 기준 (m: 1~12 → 내부는 0~11로 변환)
  const { y: ty, m: tm, d: td } = useMemo(() => kstParts(), []);
  const todayStr = ymd(ty, tm - 1, td);

  const [view, setView] = useState({ y: ty, m: tm - 1 });
  const [selected, setSelected] = useState<string>(todayStr);
  // 다른 사람이 등록한 예약 등 서버 최신 데이터를 반영하되, 내용이 같으면 리렌더 없음
  const [reservations, setReservations] = useSyncedState<Reservation[]>(initial);
  // 수정 중인 예약 id (인라인 편집 폼 노출)
  const [editId, setEditId] = useState<string | null>(null);
  // 예약 수정 폼이 열려 있는 동안 자동 동기화 보류
  useRefreshHold(editId !== null);

  // 예약 등록 폼 — 시작/종료 시간(시·분)
  const [sh, setSh] = useState(19);
  const [sm, setSm] = useState(0);
  const [eh, setEh] = useState(21);
  const [em, setEm] = useState(0);
  const [by, setBy] = useState(defaultReserver);
  const [purpose, setPurpose] = useState("합주");
  const [endDate, setEndDate] = useState(""); // MT 종료 날짜(YYYY-MM-DD)
  const [timeError, setTimeError] = useState(""); // 등록 폼 내 시간/겹침 오류
  const [notice, setNotice] = useState(""); // 저장 결과 안내(실패·부분저장). 등록/수정 공용

  // 개인연습이면 개인 이름으로만 등록 → 팀 합주일정에 안 뜸
  const isPersonal = purpose === "개인연습";
  // MT 등 기간(여러 날) 예약 여부
  const isMulti = purpose === MULTI_DAY_PURPOSE;
  // MT 종료 날짜(최소 1박) — 유효하지 않으면 시작 다음 날로 보정
  const mtEnd = isMulti ? (endDate && endDate > selected ? endDate : addDaysStr(selected, 1)) : "";
  const mtLabel = mtEnd ? nightsLabelOf(selected, mtEnd) : "";

  const firstDay = new Date(view.y, view.m, 1).getDay();
  const daysInMonth = new Date(view.y, view.m + 1, 0).getDate();

  // 선택한 날짜에 걸치는 예약(기간 예약 포함)
  const selectedDayRes = useMemo(
    () => reservations.filter((r) => spans(r, selected)),
    [reservations, selected],
  );
  const selectedList = selectedDayRes
    .slice()
    .sort((a, b) => a.time_label.localeCompare(b.time_label));

  const startMin = sh * 60 + sm;
  const endMin = eh * 60 + em;
  const timeLabel = `${pad(sh)}:${pad(sm)} - ${pad(eh)}:${pad(em)}`;

  const move = (delta: number) =>
    setView((v) => {
      const d = new Date(v.y, v.m + delta, 1);
      return { y: d.getFullYear(), m: d.getMonth() };
    });

  const addReservation = async () => {
    setTimeError("");
    if (!isMulti) {
      // 당일 예약: 시간 유효성 + 겹침 검사 (MT는 기간 예약이라 시간 검사 없음)
      if (endMin <= startMin) {
        setTimeError("종료 시간이 시작 시간보다 늦어야 합니다.");
        return;
      }
      const range: [number, number] = [startMin, endMin];
      const conflict = selectedDayRes.some((r) => overlaps(range, parseRange(r.time_label)));
      if (conflict) {
        setTimeError("이미 예약된 시간과 겹칩니다. 다른 시간을 선택해 주세요.");
        return;
      }
    }
    // 개인연습이면 개인 이름으로만 등록 (팀 합주일정에 안 뜸)
    const reservedBy = isPersonal ? myName : by;
    if (!reservedBy.trim()) return;
    const payload = {
      date: selected,
      end_date: isMulti ? mtEnd : null,
      time_label: isMulti ? mtLabel : timeLabel,
      reserved_by: reservedBy.trim(),
      purpose,
    };
    const sb = getSupabase();
    if (sb) {
      // end_date 컬럼이 아직 없을 수 있어 실패 시 컬럼 없이 재시도
      let res = await sb.from("reservations").insert(payload).select().single();
      let degraded = false; // MT 기간(end_date)을 저장하지 못하고 당일로 저장됨
      if (res.error) {
        const { end_date: _ed, ...rest } = payload;
        res = await sb.from("reservations").insert(rest).select().single();
        degraded = !res.error && isMulti;
      }
      if (res.error || !res.data) {
        // 저장 실패 — 조용히 넘어가지 않고 알리고 폼 값 유지
        setTimeError("예약 저장에 실패했습니다. 잠시 후 다시 시도해 주세요.");
        return;
      }
      setReservations((prev) => [...prev, res.data as Reservation]);
      setNotice(
        degraded
          ? "예약은 저장됐지만 MT 기간(종료 날짜)이 반영되지 않았습니다. 운영진에게 스키마 반영(supabase/schema.sql 재실행)을 요청하세요."
          : "",
      );
      router.refresh();
    } else {
      // 목업 모드: 로컬 상태에만 추가
      setReservations((prev) => [...prev, { id: `rv-${selected}-${prev.length}`, ...payload }]);
      setNotice("");
    }
    setBy(defaultReserver);
    setPurpose("합주");
    setEndDate("");
  };

  const remove = async (id: string) => {
    setReservations((prev) => prev.filter((r) => r.id !== id));
    if (editId === id) setEditId(null);
    const sb = getSupabase();
    if (sb) {
      await sb.from("reservations").delete().eq("id", id);
      router.refresh();
    }
  };

  const update = async (
    id: string,
    payload: {
      time_label: string;
      reserved_by: string;
      purpose: string;
      end_date: string | null;
    },
  ) => {
    setReservations((prev) => prev.map((r) => (r.id === id ? { ...r, ...payload } : r)));
    setEditId(null);
    setNotice("");
    const sb = getSupabase();
    if (sb) {
      // end_date 컬럼이 아직 없을 수 있어 실패 시 컬럼 없이 재시도
      let { error } = await sb.from("reservations").update(payload).eq("id", id);
      let degraded = false;
      if (error) {
        const { end_date: _ed, ...rest } = payload;
        const retry = await sb.from("reservations").update(rest).eq("id", id);
        error = retry.error;
        degraded = !error && payload.end_date != null; // 기간(end_date)을 저장 못함
      }
      if (error) {
        setNotice("수정 저장에 실패했습니다. 새로고침 후 다시 시도해 주세요.");
      } else if (degraded) {
        setNotice("수정은 저장됐지만 MT 기간(종료 날짜)이 반영되지 않았습니다. 스키마 반영(supabase/schema.sql 재실행)이 필요합니다.");
      }
      router.refresh();
    }
  };

  const cells: (number | null)[] = [
    ...Array(firstDay).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];

  const [, mo, dd] = selected.split("-");
  const selectedLabel = `${Number(mo)}월 ${Number(dd)}일`;

  return (
    <>
      <div className="card">
        <div className="cal-head">
          <button className="cal-nav" onClick={() => move(-1)} aria-label="이전 달">
            ‹
          </button>
          <span className="cal-title">
            {view.y}년 {view.m + 1}월
          </span>
          <button className="cal-nav" onClick={() => move(1)} aria-label="다음 달">
            ›
          </button>
        </div>

        <div className="cal-grid">
          {DOW.map((d) => (
            <div key={d} className="cal-dow">
              {d}
            </div>
          ))}
          {cells.map((day, i) => {
            if (day === null) return <div key={`e${i}`} className="cal-cell empty" />;
            const dateStr = ymd(view.y, view.m, day);
            const dow = (firstDay + day - 1) % 7;
            // 이 날짜에 걸치는 예약들의 색상 카테고리(순서 고정)
            const dayCats = DOT_ORDER.filter((cat) =>
              reservations.some((r) => spans(r, dateStr) && dotClassFor(r.purpose) === cat),
            );
            const cls = [
              "cal-cell",
              dow === 0 ? "sun" : "",
              dateStr === todayStr ? "today" : "",
              dateStr === selected ? "selected" : "",
            ]
              .filter(Boolean)
              .join(" ");
            return (
              <button key={dateStr} className={cls} onClick={() => setSelected(dateStr)}>
                <span>{day}</span>
                {dayCats.length > 0 && (
                  <span className="cal-dots">
                    {dayCats.map((cat) => (
                      <span key={cat || "band"} className={`cal-dot${cat ? " " + cat : ""}`} />
                    ))}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {notice && (
        <div className="card" style={{ borderColor: "var(--danger)" }}>
          <div className="flex items-center gap-8">
            <p className="form-error" style={{ margin: 0, flex: 1 }}>{notice}</p>
            <button className="btn ghost btn-sm" onClick={() => setNotice("")} aria-label="안내 닫기">
              닫기
            </button>
          </div>
        </div>
      )}

      <div className="section-title">{selectedLabel} 예약 현황</div>
      <div className="card">
        {selectedList.length === 0 ? (
          <p className="dim" style={{ fontSize: 13, margin: 0 }}>
            예약이 없습니다. 아래에서 등록하세요.
          </p>
        ) : (
          selectedList.map((r) => {
            const canCancel = canManage || r.reserved_by === myName;
            const editing = editId === r.id;
            const isSpan = !!r.end_date && r.end_date !== r.date;
            return (
              <div key={r.id}>
                <div className="res-item">
                  <span className="res-time">{r.time_label}</span>
                  <div className="grow">
                    <div className="res-by">{r.reserved_by}</div>
                    <div className="res-purpose">
                      {r.purpose}
                      {isSpan && ` · ${mdLabel(r.date)}~${mdLabel(r.end_date as string)}`}
                    </div>
                  </div>
                  {canCancel && (
                    <>
                      <button
                        className="btn ghost btn-sm"
                        onClick={() => setEditId(editing ? null : r.id)}
                        aria-label="예약 수정"
                      >
                        {editing ? "닫기" : "수정"}
                      </button>
                      <button
                        className="btn ghost btn-sm"
                        onClick={() => remove(r.id)}
                        aria-label="예약 취소"
                      >
                        취소
                      </button>
                    </>
                  )}
                </div>
                {editing && (
                  <ReservationEditor
                    res={r}
                    others={selectedDayRes.filter((x) => x.id !== r.id)}
                    canManage={canManage}
                    myName={myName}
                    myTeamNames={myTeamNames}
                    onSave={(payload) => update(r.id, payload)}
                    onCancel={() => setEditId(null)}
                  />
                )}
              </div>
            );
          })
        )}
      </div>

      <div className="section-title">{selectedLabel} 예약 등록</div>
      <div className="card">
        <div className="form-grid">
          {isMulti ? (
            // MT 등 기간 예약 — 시작일(선택 날짜) ~ 종료 날짜
            <div className="field">
              <label>MT 기간 (1박2일 등)</label>
              <div className="flex items-center gap-8">
                <input className="input grow" value={mdLabel(selected)} disabled readOnly />
                <span className="dim">~</span>
                <input
                  className="input grow"
                  type="date"
                  min={addDaysStr(selected, 1)}
                  value={mtEnd}
                  onChange={(e) => setEndDate(e.target.value)}
                />
              </div>
              <p className="dim" style={{ fontSize: 12, marginTop: 4 }}>
                {mtLabel} · 시작일은 위 달력에서 선택한 날짜입니다.
              </p>
            </div>
          ) : (
            <>
              <div className="field">
                <label>시작 시간</label>
                <div className="flex items-center gap-8">
                  <select className="select" value={sh} onChange={(e) => setSh(Number(e.target.value))}>
                    {HOURS.map((h) => (
                      <option key={h} value={h}>{pad(h)}시</option>
                    ))}
                  </select>
                  <select className="select" value={sm} onChange={(e) => setSm(Number(e.target.value))}>
                    {MINUTES.map((m) => (
                      <option key={m} value={m}>{pad(m)}분</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="field">
                <label>종료 시간</label>
                <div className="flex items-center gap-8">
                  <select className="select" value={eh} onChange={(e) => setEh(Number(e.target.value))}>
                    {HOURS.map((h) => (
                      <option key={h} value={h}>{pad(h)}시</option>
                    ))}
                  </select>
                  <select className="select" value={em} onChange={(e) => setEm(Number(e.target.value))}>
                    {MINUTES.map((m) => (
                      <option key={m} value={m}>{pad(m)}분</option>
                    ))}
                  </select>
                </div>
              </div>
            </>
          )}
          {timeError && <p className="form-error">{timeError}</p>}
          <div className="field">
            <label>예약자</label>
            <div className="flex items-center gap-8">
              {!isPersonal && reserverOptions.length > 1 ? (
                <select className="select grow" value={by} onChange={(e) => setBy(e.target.value)}>
                  <option value={myName}>{myName} (개인)</option>
                  {myTeamNames.map((tn) => (
                    <option key={tn} value={tn}>{tn} (팀)</option>
                  ))}
                </select>
              ) : (
                <input className="input grow" value={myName} disabled readOnly />
              )}
              {(purpose === "합주" || purpose === "개인연습") && (
                <label className="flex items-center gap-8" style={{ fontSize: 13, whiteSpace: "nowrap" }}>
                  <input
                    type="checkbox"
                    checked={isPersonal}
                    onChange={(e) => setPurpose(e.target.checked ? "개인연습" : "합주")}
                  />
                  개인연습
                </label>
              )}
            </div>
          </div>
          <div className="field">
            <label>용도</label>
            <select className="select" value={purpose} onChange={(e) => setPurpose(e.target.value)}>
              <option>합주</option>
              <option>개인연습</option>
              {canManage && OP_PURPOSES.map((p) => <option key={p}>{p}</option>)}
            </select>
          </div>
          <button className="btn amber" onClick={addReservation}>
            {selectedLabel}에 예약 추가
          </button>
        </div>
      </div>

      <p className="dim" style={{ fontSize: 12, textAlign: "center", marginTop: 8 }}>
        날짜를 선택해 예약을 등록하세요 (앰버 = 예약, 빨강 = 정기공연, 초록 = MT, 파랑 = 운영진회의)
      </p>
    </>
  );
}

// 기존 예약의 시간·예약자·용도(및 MT 기간)를 인라인 편집하는 폼
function ReservationEditor({
  res,
  others,
  canManage,
  myName,
  myTeamNames,
  onSave,
  onCancel,
}: {
  res: Reservation;
  others: Reservation[]; // 같은 날 다른 예약(겹침 검사용)
  canManage: boolean;
  myName: string;
  myTeamNames: string[];
  onSave: (payload: {
    time_label: string;
    reserved_by: string;
    purpose: string;
    end_date: string | null;
  }) => void;
  onCancel: () => void;
}) {
  const init = parseRange(res.time_label) ?? [19 * 60, 21 * 60];
  const [sh, setSh] = useState(Math.floor(init[0] / 60));
  const [sm, setSm] = useState(init[0] % 60);
  const [eh, setEh] = useState(Math.floor(init[1] / 60));
  const [em, setEm] = useState(init[1] % 60);
  const [by, setBy] = useState(res.reserved_by);
  const [purpose, setPurpose] = useState(res.purpose);
  const [endDate, setEndDate] = useState(res.end_date ?? "");
  const [err, setErr] = useState("");

  const isMulti = purpose === MULTI_DAY_PURPOSE;
  const mtEnd = isMulti
    ? (endDate && endDate > res.date ? endDate : addDaysStr(res.date, 1))
    : "";
  const mtLabel = mtEnd ? nightsLabelOf(res.date, mtEnd) : "";

  // 예약자 선택지: 현재 값 + 본인 이름 + 소속 팀명(최대 2개)
  const reserverOpts = Array.from(new Set([res.reserved_by, myName, ...myTeamNames]));
  // 용도 선택지: 현재 값 + 기본. 레슨/정기공연/MT/운영진회의는 운영진만
  const purposeOpts = Array.from(
    new Set([res.purpose, "합주", "개인연습", ...(canManage ? OP_PURPOSES : [])]),
  );

  const save = () => {
    setErr("");
    if (!isMulti) {
      const startMin = sh * 60 + sm;
      const endMin = eh * 60 + em;
      if (endMin <= startMin) {
        setErr("종료 시간이 시작 시간보다 늦어야 합니다.");
        return;
      }
      const range: [number, number] = [startMin, endMin];
      if (others.some((r) => overlaps(range, parseRange(r.time_label)))) {
        setErr("이미 예약된 시간과 겹칩니다. 다른 시간을 선택해 주세요.");
        return;
      }
    }
    const reservedBy = by.trim();
    if (!reservedBy) return;
    onSave({
      time_label: isMulti ? mtLabel : `${pad(sh)}:${pad(sm)} - ${pad(eh)}:${pad(em)}`,
      reserved_by: reservedBy,
      purpose,
      end_date: isMulti ? mtEnd : null,
    });
  };

  return (
    <div className="card mt-12">
      <div className="form-grid">
        {isMulti ? (
          <div className="field">
            <label>MT 기간 (1박2일 등)</label>
            <div className="flex items-center gap-8">
              <input className="input grow" value={mdLabel(res.date)} disabled readOnly />
              <span className="dim">~</span>
              <input
                className="input grow"
                type="date"
                min={addDaysStr(res.date, 1)}
                value={mtEnd}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </div>
            <p className="dim" style={{ fontSize: 12, marginTop: 4 }}>{mtLabel}</p>
          </div>
        ) : (
          <>
            <div className="field">
              <label>시작 시간</label>
              <div className="flex items-center gap-8">
                <select className="select" value={sh} onChange={(e) => setSh(Number(e.target.value))}>
                  {HOURS.map((h) => (
                    <option key={h} value={h}>{pad(h)}시</option>
                  ))}
                </select>
                <select className="select" value={sm} onChange={(e) => setSm(Number(e.target.value))}>
                  {MINUTES.map((m) => (
                    <option key={m} value={m}>{pad(m)}분</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="field">
              <label>종료 시간</label>
              <div className="flex items-center gap-8">
                <select className="select" value={eh} onChange={(e) => setEh(Number(e.target.value))}>
                  {HOURS.map((h) => (
                    <option key={h} value={h}>{pad(h)}시</option>
                  ))}
                </select>
                <select className="select" value={em} onChange={(e) => setEm(Number(e.target.value))}>
                  {MINUTES.map((m) => (
                    <option key={m} value={m}>{pad(m)}분</option>
                  ))}
                </select>
              </div>
            </div>
          </>
        )}
        {err && <p className="form-error">{err}</p>}
        <div className="field">
          <label>예약자</label>
          {reserverOpts.length > 1 ? (
            <select className="select" value={by} onChange={(e) => setBy(e.target.value)}>
              {reserverOpts.map((o) => (
                <option key={o} value={o}>{o}</option>
              ))}
            </select>
          ) : (
            <input className="input" value={by} disabled readOnly />
          )}
        </div>
        <div className="field">
          <label>용도</label>
          <select className="select" value={purpose} onChange={(e) => setPurpose(e.target.value)}>
            {purposeOpts.map((o) => (
              <option key={o} value={o}>{o}</option>
            ))}
          </select>
        </div>
        <div className="flex items-center gap-8">
          <button className="btn amber grow" onClick={save}>
            수정 저장
          </button>
          <button className="btn ghost" onClick={onCancel}>
            취소
          </button>
        </div>
      </div>
    </div>
  );
}
