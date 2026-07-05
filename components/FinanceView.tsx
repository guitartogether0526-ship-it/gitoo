"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { MonthSheet, SheetTab } from "@/lib/sheet";
import { useSyncedState } from "@/lib/use-synced-state";

/** 외부 링크(새 탭) 라인 아이콘 */
function ExternalIcon() {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{ flexShrink: 0 }}
    >
      <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
      <path d="M15 3h6v6" />
      <path d="M10 14L21 3" />
    </svg>
  );
}

function Chevron({ dir }: { dir: "left" | "right" }) {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{ flexShrink: 0 }}
    >
      {dir === "left" ? <path d="M15 18l-6-6 6-6" /> : <path d="M9 6l6 6-6 6" />}
    </svg>
  );
}

const won = (n: number | null | undefined) =>
  n === null || n === undefined ? "—" : `${n.toLocaleString("ko-KR")}원`;

/** 구글시트 링크 버튼 (새 탭) */
function SheetLink({ url, style }: { url: string; style?: React.CSSProperties }) {
  return (
    <a
      className="btn ghost btn-sm"
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      style={{ display: "inline-flex", alignItems: "center", gap: 5, ...style }}
    >
      <ExternalIcon /> 구글시트 보기
    </a>
  );
}

/**
 * 회비 페이지 본문 — 구글시트 장부 표시 전용.
 * 위에서부터: 요약 카드(잔액·이월·수입·지출) → 월 선택 → 탭(납부 현황 | 지출 내역).
 * 월 전환은 ?m=<gid> 라우팅이라 20초 자동 갱신(router.refresh) 후에도 유지된다.
 * 납부 현황 탭은 운영진(showDues)만 — 일반 회원은 지출 내역만 본다.
 */
export default function FinanceView({
  tabs: initialTabs,
  selectedGid,
  monthName,
  month: initialMonth,
  showDues,
  sheetUrl,
}: {
  tabs: SheetTab[];
  selectedGid: string;
  monthName: string;
  month: MonthSheet | null;
  showDues: boolean;
  sheetUrl: string;
}) {
  const router = useRouter();
  // 20초 자동 갱신 시 내용이 같으면 리렌더 없음 (LiveRefresh — 깜빡임 방지)
  const [tabs] = useSyncedState(initialTabs);
  const [synced] = useSyncedState({ gid: selectedGid, month: initialMonth });
  // 월 전환 직후 synced가 한 프레임 늦으므로, gid가 다르면 새 props를 그대로 사용
  const month = synced.gid === selectedGid ? synced.month : initialMonth;
  const data = month && month.recognized ? month : null;

  const [tab, setTab] = useState<"dues" | "ledger">(showDues ? "dues" : "ledger");
  const activeTab = showDues ? tab : "ledger";
  const [isPending, startTransition] = useTransition();

  const idx = tabs.findIndex((t) => t.gid === selectedGid);
  const selectMonth = (gid: string) => {
    if (gid === selectedGid) return;
    // replace: 월 전환이 뒤로가기 이력에 쌓이지 않게
    startTransition(() => router.replace(`/finance?m=${gid}`, { scroll: false }));
  };

  return (
    <>
      {/* 요약 카드 — 선택한 달의 잔액(총합계)·이월·수입·지출 */}
      <div className="card" style={{ opacity: isPending ? 0.55 : 1, transition: "opacity .15s" }}>
        <div className="title-row" style={{ alignItems: "center" }}>
          <div className="grow s-label">현재 잔액 · {monthName}</div>
          <SheetLink url={sheetUrl} />
        </div>
        <div className="amount-big" style={{ marginTop: 6, textAlign: "center" }}>
          {won(data?.grandTotal)}
        </div>
        <div className="flex between mt-12" style={{ gap: 12, textAlign: "center" }}>
          <div className="grow">
            <div className="dim" style={{ fontSize: 11 }}>이월</div>
            <div style={{ fontWeight: 800 }}>{won(data?.carryover)}</div>
          </div>
          <div className="grow">
            <div className="dim" style={{ fontSize: 11 }}>수입</div>
            <div style={{ fontWeight: 800 }}>
              {data?.incomeTotal != null ? `+${data.incomeTotal.toLocaleString("ko-KR")}원` : "—"}
            </div>
          </div>
          <div className="grow">
            <div className="dim" style={{ fontSize: 11 }}>지출</div>
            <div style={{ fontWeight: 800, color: "var(--danger)" }}>{won(data?.expenseTotal)}</div>
          </div>
        </div>
      </div>

      {/* 특이사항 — 선택한 달 시트의 특이사항 행(B=이름, C~=병합 셀 내용). 운영진 전용 */}
      {showDues && data && (
        <div className="card" style={{ opacity: isPending ? 0.55 : 1, transition: "opacity .15s" }}>
          <div className="s-label">특이사항</div>
          {data.notes.length === 0 ? (
            <p className="dim" style={{ margin: "6px 0 0", fontSize: 13 }}>
              없음
            </p>
          ) : (
            data.notes.map((n, i) => (
              <p key={i} style={{ margin: "6px 0 0", fontSize: 13 }}>
                <span style={{ fontWeight: 700 }}>{n.name}</span>
                {n.note && <span className="dim"> — {n.note}</span>}
              </p>
            ))
          )}
        </div>
      )}

      {/* 월 선택 — 시트 탭 목록(최신 달이 앞). 화살표는 목록 순서 기준 이동 */}
      <div className="flex items-center mt-12" style={{ gap: 8 }}>
        <button
          className="btn ghost btn-sm"
          onClick={() => selectMonth(tabs[idx + 1].gid)}
          disabled={idx < 0 || idx >= tabs.length - 1}
          aria-label="이전 달"
        >
          <Chevron dir="left" />
        </button>
        <select
          className="select grow"
          value={selectedGid}
          onChange={(e) => selectMonth(e.target.value)}
          aria-label="달 선택"
        >
          {tabs.map((t) => (
            <option key={t.gid} value={t.gid}>
              {t.name}
            </option>
          ))}
        </select>
        <button
          className="btn ghost btn-sm"
          onClick={() => selectMonth(tabs[idx - 1].gid)}
          disabled={idx <= 0}
          aria-label="다음 달"
        >
          <Chevron dir="right" />
        </button>
      </div>

      {showDues ? (
        <div className="tab-row mt-12">
          <button
            className={`tab${activeTab === "dues" ? " active" : ""}`}
            onClick={() => setTab("dues")}
          >
            납부 현황
          </button>
          <button
            className={`tab${activeTab === "ledger" ? " active" : ""}`}
            onClick={() => setTab("ledger")}
          >
            지출 내역
          </button>
        </div>
      ) : (
        <div className="section-title">지출 내역</div>
      )}

      <div style={{ opacity: isPending ? 0.55 : 1, transition: "opacity .15s" }}>
        {!data ? (
          <div className="card">
            <p className="dim" style={{ margin: 0, fontSize: 13 }}>
              이 달({monthName}) 시트를 자동으로 읽지 못했습니다. 구글시트에서 직접 확인해 주세요.
            </p>
            <SheetLink url={sheetUrl} style={{ marginTop: 10 }} />
          </div>
        ) : activeTab === "dues" ? (
          <DuesTab data={data} monthName={monthName} />
        ) : (
          <LedgerTab data={data} />
        )}
      </div>
    </>
  );
}

/** 납부 현황 탭 (운영진 전용) — 이름별 납부/미납. 금액은 표시하지 않는다. */
function DuesTab({ data, monthName }: { data: MonthSheet; monthName: string }) {
  // 납부액 또는 "-" 등 표기가 있으면 납부로 센다 (빈칸만 미납)
  const isPaid = (m: MonthSheet["members"][number]) => m.amount !== null || m.raw !== "";
  const paid = data.members.filter(isPaid).length;

  return (
    <>
      <div className="section-title">
        {monthName} 납부 현황 ({paid}/{data.members.length})
      </div>
      <div className="card">
        {data.members.length === 0 ? (
          <p className="dim" style={{ margin: 0, fontSize: 13 }}>
            아직 기록이 없습니다.
          </p>
        ) : (
          data.members.map((m, i) => (
            <div
              key={`${m.name}-${i}`}
              className="flex between items-center"
              style={{
                padding: "10px 0",
                borderBottom: i < data.members.length - 1 ? "1px solid var(--border)" : "none",
              }}
            >
              <span>{m.name}</span>
              {isPaid(m) ? (
                <span className="badge ok">납부</span>
              ) : (
                <span className="badge danger">미납</span>
              )}
            </div>
          ))
        )}
      </div>
    </>
  );
}

/** 지출 내역 탭 — 항목별 지출액 (환급·캐시백은 음수 그대로 표시) */
function LedgerTab({ data }: { data: MonthSheet }) {
  return (
    <div className="card" style={{ padding: 12 }}>
      {data.expenses.length === 0 ? (
        <p className="dim" style={{ margin: 0, fontSize: 13, padding: 4 }}>
          아직 기록이 없습니다.
        </p>
      ) : (
        <table className="ledger">
          <thead>
            <tr>
              <th>내역</th>
              <th style={{ textAlign: "right" }}>금액</th>
            </tr>
          </thead>
          <tbody>
            {data.expenses.map((x, i) => (
              <tr key={i}>
                <td>{x.item}</td>
                <td className="amount">
                  {x.amount === null ? "—" : x.amount.toLocaleString("ko-KR")}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <td style={{ fontWeight: 800 }}>합계</td>
              <td className="amount" style={{ fontWeight: 800, color: "var(--danger)" }}>
                {data.expenseTotal === null ? "—" : data.expenseTotal.toLocaleString("ko-KR")}
              </td>
            </tr>
          </tfoot>
        </table>
      )}
    </div>
  );
}
