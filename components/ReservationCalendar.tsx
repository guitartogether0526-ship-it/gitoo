"use client";

import { useMemo, useState } from "react";
import type { Reservation } from "@/lib/types";

const DOW = ["일", "월", "화", "수", "목", "금", "토"];
const pad = (n: number) => String(n).padStart(2, "0");
const ymd = (y: number, m: number, d: number) => `${y}-${pad(m + 1)}-${pad(d)}`;

export default function ReservationCalendar({ initial }: { initial: Reservation[] }) {
  const today = useMemo(() => new Date(), []);
  const todayStr = ymd(today.getFullYear(), today.getMonth(), today.getDate());

  const [view, setView] = useState({ y: today.getFullYear(), m: today.getMonth() });
  const [selected, setSelected] = useState<string>(todayStr);
  const [reservations, setReservations] = useState<Reservation[]>(initial);

  // 예약 등록 폼
  const [time, setTime] = useState("19:00 - 21:00");
  const [by, setBy] = useState("나");
  const [purpose, setPurpose] = useState("합주");

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

  const move = (delta: number) =>
    setView((v) => {
      const d = new Date(v.y, v.m + delta, 1);
      return { y: d.getFullYear(), m: d.getMonth() };
    });

  // 추후: supabase.from("reservations").insert({ date, time_label, reserved_by, purpose })
  const addReservation = () => {
    if (!time.trim() || !by.trim()) return;
    setReservations((prev) => [
      ...prev,
      {
        id: `rv-${selected}-${prev.length}`,
        date: selected,
        time_label: time.trim(),
        reserved_by: by.trim(),
        purpose: purpose.trim() || "합주",
      },
    ]);
    setTime("19:00 - 21:00");
    setPurpose("합주");
  };

  // 추후: supabase.from("reservations").delete().eq("id", id)
  const remove = (id: string) =>
    setReservations((prev) => prev.filter((r) => r.id !== id));

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
          selectedList.map((r) => (
            <div key={r.id} className="res-item">
              <span className="res-time">{r.time_label}</span>
              <div className="grow">
                <div className="res-by">{r.reserved_by}</div>
                <div className="res-purpose">{r.purpose}</div>
              </div>
              <button
                className="btn ghost btn-sm"
                onClick={() => remove(r.id)}
                aria-label="예약 취소"
              >
                취소
              </button>
            </div>
          ))
        )}
      </div>

      <div className="section-title">➕ {selectedLabel} 예약 등록</div>
      <div className="card">
        <div className="form-grid">
          <div className="field">
            <label>시간</label>
            <input
              className="input"
              value={time}
              onChange={(e) => setTime(e.target.value)}
              placeholder="예: 19:00 - 21:00"
            />
          </div>
          <div className="field">
            <label>예약자 / 팀</label>
            <input
              className="input"
              value={by}
              onChange={(e) => setBy(e.target.value)}
              placeholder="이름 또는 팀명"
            />
          </div>
          <div className="field">
            <label>용도</label>
            <select className="select" value={purpose} onChange={(e) => setPurpose(e.target.value)}>
              <option>합주</option>
              <option>개인 연습</option>
              <option>정기 합주</option>
              <option>레슨</option>
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
