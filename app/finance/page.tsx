import { getExpenses, getDues } from "@/lib/db";

function formatDate(d: string) {
  const [, m, day] = d.split("-");
  return `${Number(m)}.${day}`;
}

export default async function FinancePage() {
  const [expenses, dues] = await Promise.all([getExpenses(), getDues()]);

  const income = expenses.filter((e) => e.amount > 0).reduce((s, e) => s + e.amount, 0);
  const outcome = expenses.filter((e) => e.amount < 0).reduce((s, e) => s + e.amount, 0);
  const balance = income + outcome;
  const paid = dues.filter((d) => d.paid).length;

  return (
    <>
      <div className="page-head">
        <h1>회비 · 총무 장부</h1>
        <p>납부 현황 및 지출 내역</p>
      </div>

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

      {/* 회비 납부 현황 */}
      <div className="section-title">💳 6월 회비 납부 현황 ({paid}/{dues.length})</div>
      <div className="card">
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
              {d.member_name} <span className="dim" style={{ fontSize: 12 }}>{d.cohort}기</span>
            </span>
            <span className={`badge ${d.paid ? "ok" : "danger"}`}>
              {d.paid ? "납부 완료" : "미납"}
            </span>
          </div>
        ))}
      </div>

      {/* 지출 내역 */}
      <div className="section-title">🧾 지출 / 수입 내역</div>
      <div className="card" style={{ padding: 12 }}>
        <table className="ledger">
          <thead>
            <tr>
              <th>날짜</th>
              <th>항목</th>
              <th style={{ textAlign: "right" }}>금액</th>
              <th style={{ textAlign: "center" }}>영수증</th>
            </tr>
          </thead>
          <tbody>
            {expenses.map((e) => (
              <tr key={e.id}>
                <td className="dim">{formatDate(e.date)}</td>
                <td>{e.item}</td>
                <td className={`amount${e.amount < 0 ? " out" : ""}`}>
                  {e.amount > 0 ? "+" : ""}
                  {e.amount.toLocaleString()}
                </td>
                <td style={{ textAlign: "center" }}>
                  {e.has_receipt ? <span className="receipt" title="영수증 첨부됨">🧾</span> : <span className="dim">—</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="dim" style={{ fontSize: 11, textAlign: "center", marginTop: 12 }}>
        총 잔액은 앰버 색상으로 강조됩니다 · 영수증 이미지 첨부 지원
      </p>
    </>
  );
}
