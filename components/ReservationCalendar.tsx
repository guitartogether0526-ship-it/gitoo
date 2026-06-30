"use client";

import { useMemo, useState } from "react";
import type { Reservation } from "@/lib/types";
import { getSupabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth";
import { can } from "@/lib/roles";

const DOW = ["일", "월", "화", "수", "목", "금", "토"];
const pad = (n: number) => String(n).padStart(2, "0");
const ymd = (y: number, m: number, d: number) => `${y}-${pad(m + 1)}-${pad(d)}`;

// 선택 가능한 예약 시간대 (2시간 단위)
const TIME_SLOTS = [
  "09:00 - 11:00",
  "11:00 - 13:00",
  "13:00 - 15:00",
  "15:00 - 17:00",
  "17:00 - 19:00",
  "19:00 - 21:00",
  "21:00 - 23:00",
];

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

  // 예약 등록 폼
  const [time, setTime] = useState("");
  const [by, setBy] = useState(myName);
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

  // 선택한 날짜에 이미 예약된 시간과 겹치지 않는 시간대만 노출
  const availableSlots = useMemo(() => {
    const taken = (byDate[selected] ?? []).map((r) => parseRange(r.time_label));
    return TIME_SLOTS.filter((slot) => {
      const range = parseRange(slot);
      return !taken.some((t) => overlaps(range, t));
    });
  }, [byDate, selected]);

  // 현재 선택값이 더 이상 선택 불가하면 첫 번째 가능 시간으로 대체
  const effectiveTime = availableSlots.includes(time) ? time : availableSlots[0] ?? "";

  const move = (delta: number) =>
    setView((v) => {
      const d = new Date(v.y, v.m + delta, 1);
      return { y: d.getFullYear(), m: d.getMonth() };
    });

  const addReservation = async () => {
    if (!effectiveTime || !by.trim()) return;
    // 동시 예약 방지: 등록 직전 한 번 더 겹침 검사
    const range = parseRange(effectiveTime);
    const conflict = (byDate[selected] ?? []).some((r) => overlaps(range, parseRange(r.time_label)));
    if (conflict) {
      alert("방금 다른 예약과 겹쳤습니다. 다른 시간을 선택해 주세요.");
      return;
    }
    const payload = {
      date: selected,
      time_label: effectiveTime,
      reserved_by: by.trim(),
      purpose: purpose.trim() || "합주",
    };
    const sb = getSupabase();
    if (sb) {
      const { data, error } = await sb.from("reservations").insert(payload).select().single();
      if (!error && data) setReservations((prev) => [...prev, data as Reservation]);
    } else {
      // 목업 모드: 로컬 상태에만 추가
      setReservations((prev) => [...prev, { id: `rv-${selected}-${prev.length}`, ...payload }]);
    }
    setTime("");
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
            <label>시간</label>
            {availableSlots.length === 0 ? (
              <p className="dim" style={{ fontSize: 13, margin: "4px 0" }}>
                이 날짜는 모든 시간대가 예약되어 있어요.
              </p>
            ) : (
              <select
                className="select"
                value={effectiveTime}
                onChange={(e) => setTime(e.target.value)}
              >
                {availableSlots.map((slot) => (
                  <option key={slot} value={slot}>
                    {slot}
                  </option>
                ))}
              </select>
            )}
          </div>
          <div className="field">
            <label>예약자</label>
            {reserverOptions.length > 1 ? (
              <select className="select" value={by} onChange={(e) => setBy(e.target.value)}>
                <option value={myName}>{myName} (개인)</option>
                <option value={myTeamName as string}>{myTeamName} (팀)</option>
              </select>
            ) : (
              <input className="input" value={myName} disabled readOnly />
            )}
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
          <button
            className="btn amber"
            onClick={addReservation}
            disabled={availableSlots.length === 0}
          >
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
