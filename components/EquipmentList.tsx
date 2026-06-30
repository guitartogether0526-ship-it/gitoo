"use client";

import { useMemo, useState } from "react";
import type { Equipment, EquipmentStatus } from "@/lib/types";

const STATUS_BADGE: Record<EquipmentStatus, { label: string; cls: string }> = {
  available: { label: "대여 가능", cls: "ok" },
  rented: { label: "대여 중", cls: "amber" },
  repair: { label: "수리 중", cls: "danger" },
};

export default function EquipmentList({ initial }: { initial: Equipment[] }) {
  const [items, setItems] = useState<Equipment[]>(initial);
  const [cat, setCat] = useState<string>("전체");

  const categories = useMemo(
    () => ["전체", ...Array.from(new Set(initial.map((e) => e.category))).sort((a, b) => a.localeCompare(b, "ko"))],
    [initial],
  );

  const visible = items.filter((e) => cat === "전체" || e.category === cat);

  // 추후: supabase.from("equipment").update({ status, rented_by }).eq("id", id)
  const setStatus = (id: string, status: EquipmentStatus, rentedBy: string | null) =>
    setItems((prev) => prev.map((e) => (e.id === id ? { ...e, status, rented_by: rentedBy } : e)));

  return (
    <>
      <div className="chip-row">
        {categories.map((c) => (
          <button key={c} className={`chip${cat === c ? " active" : ""}`} onClick={() => setCat(c)}>
            {c}
          </button>
        ))}
      </div>

      {visible.map((e) => {
        const badge = STATUS_BADGE[e.status];
        return (
          <div className="card" key={e.id}>
            <div className="card-row">
              <div className="thumb">{e.emoji}</div>
              <div className="grow">
                <div className="title-row">
                  <div className="item-name">{e.name}</div>
                  <span className={`badge ${badge.cls}`}>{badge.label}</span>
                </div>
                <div className="item-sub">
                  {e.category} · 수량 {e.quantity}개
                  {e.rented_by ? ` · 대여자: ${e.rented_by}` : ""}
                </div>
              </div>
            </div>

            <div className="btn-row">
              {e.status === "available" && (
                <button className="btn amber btn-sm" onClick={() => setStatus(e.id, "rented", "나")}>
                  대여하기
                </button>
              )}
              {e.status === "rented" && (
                <button className="btn btn-sm" onClick={() => setStatus(e.id, "available", null)}>
                  반납하기
                </button>
              )}
              {e.status === "repair" ? (
                <button className="btn btn-sm" onClick={() => setStatus(e.id, "available", null)}>
                  수리 완료
                </button>
              ) : (
                <button className="btn danger btn-sm" onClick={() => setStatus(e.id, "repair", null)}>
                  고장 신고
                </button>
              )}
            </div>
          </div>
        );
      })}
    </>
  );
}
