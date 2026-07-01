import { getExpenses, getDues } from "@/lib/db";
import FinanceManager from "@/components/FinanceManager";

export const dynamic = "force-dynamic";

export default async function FinancePage() {
  const [expenses, dues] = await Promise.all([getExpenses(), getDues()]);

  return (
    <>
      <div className="page-head">
        <h1>회비 · 총무 장부</h1>
        <p>납부 현황 및 지출 내역</p>
      </div>

      <FinanceManager expenses={expenses} dues={dues} />

      <p className="dim" style={{ fontSize: 11, textAlign: "center", marginTop: 12 }}>
        총 잔액은 앰버 색상으로 강조됩니다
      </p>
    </>
  );
}
