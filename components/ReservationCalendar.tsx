"use client";

import { useMemo, useState } from "react";
import type { Reservation } from "@/lib/types";
import { getSupabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth";
import { can } from "@/lib/roles";

const DOW = ["일", "월", "화", "수", "목", "금", "토"];
const pad = (n: number) => String(n).padStart(2, "0");
const ymd = (y: number, m: number, d: number) => `${y}-${pad(m + 1)}-${pad(d)}`;

// 시작/종료 시간 선택용 (시 09~23, 분 10분 단위)
const HOURS = Array.from({ length: 15 }, (_, i) => 9 + i); // 9..23
const MINUTES = [0, 10, 20, 30, 40, 50];

// "HH:MM - HH:MM" → [시작분, 끝분]
const parseRange = (label: string): [number, number] | null => {
  const m = label.match(/(\d{1,2}):(\d{2})\s*-\s*(\d{1,2}):(\d{2})/);
  if (!m) return null;
  return [Number(m[1]) * 60 + Number(m[2]), Number(m[3]) * 60 + Number(m[4])];
};

// 두 시간대가 겹치는지
const overlaps = (a: [number, number] | null, b: [number, number] | null) =>
  !!a && !!b && a[0] < b[1] && b[0] < a[1];

export default function ReservationCalendar({
  initial,
  myTeamName,
}: {
  initial: Reservation[];
  myTeamName: string | null;
}) {
  const { user } = useAuth();
  const canManage = can.manageReservations(user?.role);
  const myName = user?.name ?? "나";
  // 예약자 선택지: 본인 이름(기본) + 팀이 있으면 팀명. 팀 없으면 개인 이름만.
  const reserverOptions = myTeamName ? [myName, myTeamName] : [myName];

  const today = useMemo(() => new Date(), []);
  const todayStr = ymd(today.getFullYear(), today.getMonth(), today.getDate());

  const [view, setView] = useState({ y: today.getFullYear(), m: today.getMonth() });
  const [selected, setSelected] = useState<string>(todayStr);
  const [reservations, setReservations] = useState<Reservation[]>(initial);

  // 예약 등록 폼 — 시작/종료 시간(시·분)
  const [sh, setSh] = useState(19);
  const [sm, setSm] = useState(0);
  const [eh, setEh] = useState(21);
  const [em, setEm] = useState(0);
  const [by, setBy] = useState(myName);
  const [purpose, setPurpose] = useState("합주");
  const [timeError, setTimeError] = useState("");

  // 개인연습이면 개인 이름으로만 등록 → 팀 합주일정에 안 뜸
  const isPersonal = purpose === "개인연습";

  const firstDay = new Date(view.y, view.m, 1).getDay();
  const daysInMonth = new Date(view.y, view.m + 1, 0).getDate();

  // 날짜별 예약 그룹
  const byDate = useMemo(() => {
    const map: Record<string, Reservation[]> = {};
    for (const r of reservations) (map[r.date] ||= []).push(r);
    return map;
  }, [reservations]);

  const selectedList = (byDate[selected] ?? [])
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
    if (endMin <= startMin) {
      setTimeError("종료 시간이 시작 시간보다 늦어야 합니다.");
      return;
    }
    // 동시 예약 방지: 등록 직전 겹침 검사
    const range: [number, number] = [startMin, endMin];
    const conflict = (byDate[selected] ?? []).some((r) => overlaps(range, parseRange(r.time_label)));
    if (conflict) {
      setTimeError("이미 예약된 시간과 겹칩니다. 다른 시간을 선택해 주세요.");
      return;
    }
    // 개인연습이면 개인 이름으로만 등록 (팀 합주일정에 안 뜸)
    const reservedBy = isPersonal ? myName : by;
    if (!reservedBy.trim()) return;
    const payload = {
      date: selected,
      time_label: timeLabel,
      reserved_by: reservedBy.trim(),
      purpose,
    };
    const sb = getSupabase();
    if (sb) {
      const { data, error } = await sb.from("reservations").insert(payload).select().single();
      if (!error && data) setReservations((prev) => [...prev, data as Reservation]);
    } else {
      // 목업 모드: 로컬 상태에만 추가
      setReservations((prev) => [...prev, { id: `rv-${selected}-${prev.length}`, ...payload }]);
    }
    setBy(myName);
    setPurpose("합주");
  };

  const remove = async (id: string) => {
    setReservations((prev) => prev.filter((r) => r.id !== id));
    const sb = getSupabase();
    if (sb) await sb.from("reservations").delete().eq("id", id);
  };

  const cells: (number | null)[] = [
    ...Array(firstDay).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];

  const [y, mo, dd] = selected.split("-");
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
            const has = (byDate[dateStr]?.length ?? 0) > 0;
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
                {has && <span className="cal-dot" />}
              </button>
            );
          })}
        </div>
      </div>

      <div className="section-title">📅 {selectedLabel} 예약 현황</div>
      <div className="card">
        {selectedList.length === 0 ? (
          <p className="dim" style={{ fontSize: 13, margin: 0 }}>
            예약이 없습니다. 아래에서 등록하세요.
          </p>
        ) : (
          selectedList.map((r) => {
            const canCancel = canManage || r.reserved_by === myName;
            return (
              <div key={r.id} className="res-item">
                <span className="res-time">{r.time_label}</span>
                <div className="grow">
                  <div className="res-by">{r.reserved_by}</div>
                  <div className="res-purpose">{r.purpose}</div>
                </div>
                {canCancel && (
                  <button
                    className="btn ghost btn-sm"
                    onClick={() => remove(r.id)}
                    aria-label="예약 취소"
                  >
                    취소
                  </button>
                )}
              </div>
            );
          })
        )}
      </div>

      <div className="section-title">➕ {selectedLabel} 예약 등록</div>
      <div className="card">
        <div className="form-grid">
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
          {timeError && <p className="form-error">{timeError}</p>}
          <div className="field">
            <label>예약자</label>
            <div className="flex items-center gap-8">
              {!isPersonal && reserverOptions.length > 1 ? (
                <select className="select grow" value={by} onChange={(e) => setBy(e.target.value)}>
                  <option value={myName}>{myName} (개인)</option>
                  <option value={myTeamName as string}>{myTeamName} (팀)</option>
                </select>
              ) : (
                <input className="input grow" value={myName} disabled readOnly />
              )}
              <label className="flex items-center gap-8" style={{ fontSize: 13, whiteSpace: "nowrap" }}>
                <input
                  type="checkbox"
                  checked={isPersonal}
                  onChange={(e) => setPurpose(e.target.checked ? "개인연습" : "합주")}
                />
                개인연습
              </label>
            </div>
          </div>
          <div className="field">
            <label>용도</label>
            <select className="select" value={purpose} onChange={(e) => setPurpose(e.target.value)}>
              <option>합주</option>
              <option>개인연습</option>
              {canManage && <option>레슨</option>}
            </select>
          </div>
          <button className="btn amber" onClick={addReservation}>
            {selectedLabel}에 예약 추가
          </button>
        </div>
      </div>

      <p className="dim" style={{ fontSize: 12, textAlign: "center", marginTop: 8 }}>
        연습실 1실 · 날짜를 선택해 예약을 등록하세요 (앰버 점 = 예약 있는 날)
      </p>
    </>
  );
}
