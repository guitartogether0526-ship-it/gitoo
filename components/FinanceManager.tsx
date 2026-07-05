"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { DuesPayment, Expense } from "@/lib/types";
import { getSupabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth";
import { can } from "@/lib/roles";
import { kstMonthLabel, kstYmd } from "@/lib/date";
import { useRefreshHold } from "@/lib/refresh-hold";
import { useSyncedState } from "@/lib/use-synced-state";

function formatDate(d: string) {
  const [, m, day] = d.split("-");
  return `${Number(m)}.${day}`;
}

export default function FinanceManager({
  expenses: initialExpenses,
  dues: initialDues,
}: {
  expenses: Expense[];
  dues: DuesPayment[];
}) {
  const { user } = useAuth();
  const router = useRouter();
  const canEdit = can.editFinance(user?.role);
  // 회비 납부 현황은 운영진(관리자·회장·총무·STAFF)만 열람
  const canViewDues = can.manageMembers(user?.role);

  // 서버 최신 데이터를 화면에 반영하되, 내용이 같으면 리렌더 없음 (LiveRefresh/새로고침 시)
  const [expenses, setExpenses] = useSyncedState<Expense[]>(initialExpenses);
  const [dues, setDues] = useSyncedState<DuesPayment[]>(initialDues);

  // 지출/수입 추가 폼
  const [showForm, setShowForm] = useState(false);
  const [item, setItem] = useState("");
  const [amount, setAmount] = useState("");
  const [kind, setKind] = useState<"out" | "in">("out");
  // 수정 중인 내역 id (인라인 편집 폼 노출)
  const [editId, setEditId] = useState<string | null>(null);

  // 내역 추가/수정 폼이 열려 있는 동안 자동 동기화 보류
  useRefreshHold(showForm || editId !== null);

  const income = expenses.filter((e) => e.amount > 0).reduce((s, e) => s + e.amount, 0);
  const outcome = expenses.filter((e) => e.amount < 0).reduce((s, e) => s + e.amount, 0);
  const balance = income + outcome;
  const paid = dues.filter((d) => d.paid).length;

  const sortedExpenses = useMemo(
    () => expenses.slice().sort((a, b) => a.date.localeCompare(b.date)),
    [expenses],
  );

  const togglePaid = async (d: DuesPayment) => {
    if (!canEdit) return;
    const next = !d.paid;
    setDues((prev) =>
      prev.map((x) =>
        x.member_name === d.member_name && x.month === d.month ? { ...x, paid: next } : x,
      ),
    );
    const sb = getSupabase();
    if (sb) {
      // 명단은 회원 목록에서 생성되므로 dues 행이 아직 없을 수 있다 → 있으면 update, 없으면 insert
      const { data: existing } = await sb
        .from("dues")
        .select("id")
        .eq("member_name", d.member_name)
        .eq("month", d.month)
        .limit(1);
      if (existing && existing.length > 0) {
        await sb
          .from("dues")
          .update({ paid: next })
          .eq("member_name", d.member_name)
          .eq("month", d.month);
      } else {
        await sb
          .from("dues")
          .insert({ member_name: d.member_name, cohort: 0, paid: next, month: d.month });
      }
      router.refresh();
    }
  };

  const addExpense = async () => {
    if (!canEdit || !item.trim() || !amount.trim()) return;
    const abs = Math.abs(Number(amount.replace(/[^0-9.-]/g, "")));
    if (!abs) return;
    const today = kstYmd(); // 오늘 날짜 (한국시간 기준)
    const payload = {
      date: today,
      item: item.trim(),
      amount: kind === "out" ? -abs : abs,
    };
    const sb = getSupabase();
    if (sb) {
      const { data, error } = await sb.from("expenses").insert(payload).select().single();
      if (!error && data) {
        setExpenses((prev) => [...prev, data as Expense]);
        router.refresh();
      }
    } else {
      setExpenses((prev) => [...prev, { id: `x-${prev.length}`, ...payload }]);
    }
    setItem("");
    setAmount("");
    setShowForm(false);
  };

  const updateExpense = async (id: string, payload: { item: string; amount: number }) => {
    if (!canEdit) return;
    setExpenses((prev) => prev.map((e) => (e.id === id ? { ...e, ...payload } : e)));
    setEditId(null);
    const sb = getSupabase();
    if (sb) {
      await sb.from("expenses").update(payload).eq("id", id);
      router.refresh();
    }
  };

  return (
    <>
      {/* 잔액 강조 카드 */}
      <div className="card" style={{ textAlign: "center" }}>
        <div className="s-label">현재 잔액</div>
        <div className="amount-big" style={{ marginTop: 6 }}>
          {balance.toLocaleString()}원
        </div>
        <div className="flex between mt-12" style={{ gap: 12 }}>
          <div className="grow">
            <div className="dim" style={{ fontSize: 11 }}>수입</div>
            <div style={{ fontWeight: 800 }}>+{income.toLocaleString()}원</div>
          </div>
          <div className="grow">
            <div className="dim" style={{ fontSize: 11 }}>지출</div>
            <div style={{ fontWeight: 800, color: "var(--danger)" }}>
              {outcome.toLocaleString()}원
            </div>
          </div>
        </div>
      </div>

      {!canEdit && (
        <p className="dim" style={{ fontSize: 12, textAlign: "center", margin: "10px 0 0" }}>
          읽기 전용 — 회비·장부 편집은 회장·총무만 가능합니다.
        </p>
      )}

      {/* 회비 납부 현황 — 운영진(STAFF 이상)만 열람 */}
      {canViewDues && (
        <>
          <div className="section-title">{kstMonthLabel()} 회비 납부 현황 ({paid}/{dues.length})</div>
          <div className="card">
            {dues.length === 0 && (
              <p className="dim" style={{ margin: 0, fontSize: 13 }}>
                승인된 활동 회원이 없습니다. 회원 승인 후 이곳에 표시됩니다.
              </p>
            )}
            {dues.map((d, i) => (
              <div
                key={d.member_name}
                className="flex between items-center"
                style={{
                  padding: "10px 0",
                  borderBottom: i < dues.length - 1 ? "1px solid var(--border)" : "none",
                }}
              >
                <span>
                  {d.member_name}
                  {d.part && (
                    <span className="dim" style={{ fontSize: 12 }}> · {d.part}</span>
                  )}
                </span>
                {canEdit ? (
                  <button
                    className={`badge ${d.paid ? "ok" : "danger"}`}
                    style={{ cursor: "pointer" }}
                    onClick={() => togglePaid(d)}
                    title="납부 상태 변경"
                  >
                    {d.paid ? "납부 완료" : "미납"}
                  </button>
                ) : (
                  <span className={`badge ${d.paid ? "ok" : "danger"}`}>
                    {d.paid ? "납부 완료" : "미납"}
                  </span>
                )}
              </div>
            ))}
          </div>
        </>
      )}

      {/* 지출 내역 */}
      <div className="section-title">지출 / 수입 내역</div>

      {canEdit && (
        <>
          <button
            className="btn amber"
            style={{ width: "100%" }}
            onClick={() => setShowForm((v) => !v)}
          >
            {showForm ? "닫기" : "＋ 내역 추가"}
          </button>
          {showForm && (
            <div className="card mt-12">
              <div className="form-grid">
                <div className="field">
                  <label>항목</label>
                  <input className="input" value={item} onChange={(e) => setItem(e.target.value)} placeholder="예: 연습실 대관료" />
                </div>
                <div className="field">
                  <label>금액 (원)</label>
                  <input className="input" inputMode="numeric" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="예: 60000" />
                </div>
                <div className="field">
                  <label>구분</label>
                  <select className="select" value={kind} onChange={(e) => setKind(e.target.value as "out" | "in")}>
                    <option value="out">지출</option>
                    <option value="in">수입</option>
                  </select>
                </div>
                <button className="btn amber" onClick={addExpense}>
                  장부에 등록
                </button>
              </div>
            </div>
          )}
        </>
      )}

      <div className="card mt-12" style={{ padding: 12 }}>
        <table className="ledger">
          <thead>
            <tr>
              <th>날짜</th>
              <th>항목</th>
              <th style={{ textAlign: "right" }}>금액</th>
              {canEdit && <th style={{ textAlign: "center" }}>수정</th>}
            </tr>
          </thead>
          <tbody>
            {sortedExpenses.map((e) =>
              editId === e.id ? (
                <tr key={e.id}>
                  <td colSpan={canEdit ? 4 : 3} style={{ padding: 0 }}>
                    <ExpenseEditor
                      expense={e}
                      onSave={(payload) => updateExpense(e.id, payload)}
                      onCancel={() => setEditId(null)}
                    />
                  </td>
                </tr>
              ) : (
                <tr key={e.id}>
                  <td className="dim">{formatDate(e.date)}</td>
                  <td>{e.item}</td>
                  <td className={`amount${e.amount < 0 ? " out" : ""}`}>
                    {e.amount > 0 ? "+" : ""}
                    {e.amount.toLocaleString()}
                  </td>
                  {canEdit && (
                    <td style={{ textAlign: "center" }}>
                      <button
                        className="btn ghost btn-sm"
                        onClick={() => setEditId(e.id)}
                        aria-label="내역 수정"
                      >
                        수정
                      </button>
                    </td>
                  )}
                </tr>
              ),
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}

// 기존 지출/수입 내역의 항목·금액·구분을 인라인 편집하는 폼
function ExpenseEditor({
  expense,
  onSave,
  onCancel,
}: {
  expense: Expense;
  onSave: (payload: { item: string; amount: number }) => void;
  onCancel: () => void;
}) {
  const [item, setItem] = useState(expense.item);
  const [amount, setAmount] = useState(String(Math.abs(expense.amount)));
  const [kind, setKind] = useState<"out" | "in">(expense.amount < 0 ? "out" : "in");

  const save = () => {
    const abs = Math.abs(Number(amount.replace(/[^0-9.-]/g, "")));
    if (!item.trim() || !abs) return;
    onSave({ item: item.trim(), amount: kind === "out" ? -abs : abs });
  };

  return (
    <div className="card" style={{ margin: 8 }}>
      <div className="form-grid">
        <div className="field">
          <label>항목</label>
          <input className="input" value={item} onChange={(e) => setItem(e.target.value)} />
        </div>
        <div className="field">
          <label>금액 (원)</label>
          <input
            className="input"
            inputMode="numeric"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
          />
        </div>
        <div className="field">
          <label>구분</label>
          <select className="select" value={kind} onChange={(e) => setKind(e.target.value as "out" | "in")}>
            <option value="out">지출</option>
            <option value="in">수입</option>
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
