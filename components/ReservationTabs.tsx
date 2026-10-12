"use client";

import { useState } from "react";

/** 예약 페이지 상단 탭 — 기본은 "예약하기", 두 번째가 "안되는 날 체크" */
export default function ReservationTabs({
  reserve,
  unavailable,
}: {
  reserve: React.ReactNode;
  unavailable: React.ReactNode;
}) {
  const [tab, setTab] = useState<"reserve" | "unavailable">("reserve");
  return (
    <>
      <div className="tab-row">
        <button className={`tab${tab === "reserve" ? " active" : ""}`} onClick={() => setTab("reserve")}>
          예약하기
        </button>
        <button
          className={`tab${tab === "unavailable" ? " active" : ""}`}
          onClick={() => setTab("unavailable")}
        >
          안되는 날 체크
        </button>
      </div>
      {tab === "reserve" ? reserve : unavailable}
    </>
  );
}
