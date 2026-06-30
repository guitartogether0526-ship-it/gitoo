import Link from "next/link";
import { getNotices, getReservations, getExpenses, getDues } from "@/lib/db";

function formatDate(iso: string) {
  const d = new Date(iso);
  return `${d.getMonth() + 1}월 ${d.getDate()}일`;
}

function shortDate(d: string) {
  const [, m, day] = d.split("-");
  return `${Number(m)}/${day}`;
}

export default async function DashboardPage() {
  const [notices, reservations, expenses, dues] = await Promise.all([
    getNotices(),
    getReservations(),
    getExpenses(),
    getDues(),
  ]);

  const myNext = reservations.find((r) => r.reserved_by === "나");
  const balance = expenses.reduce((sum, e) => sum + e.amount, 0);
  const paidCount = dues.filter((d) => d.paid).length;

  return (
    <>
      <div className="page-head">
        <h1>안녕하세요, 기타리스트님 🎸</h1>
        <p>오늘의 동호회 소식을 확인하세요.</p>
      </div>

      <div className="stat-grid">
        <div className="stat">
          <div className="s-label">다음 내 예약</div>
          <div className="s-value">
            {myNext ? (
              <span className="amber-text">{shortDate(myNext.date)}</span>
            ) : (
              <span className="dim">없음</span>
            )}
          </div>
          <div className="dim" style={{ fontSize: 11, marginTop: 2 }}>
            {myNext ? `${myNext.time_label} · ${myNext.purpose}` : "예약 화면에서 추가"}
          </div>
        </div>
        <div className="stat">
          <div className="s-label">총무 장부 잔액</div>
          <div className="s-value amber-text">{balance.toLocaleString()}원</div>
          <div className="dim" style={{ fontSize: 11, marginTop: 2 }}>
            6월 회비 {paidCount}/{dues.length}명 납부
          </div>
        </div>
      </div>

      <div className="section-title">📢 공지사항</div>

      {notices.map((n) => (
        <div className="card" key={n.id}>
          <div className="title-row">
            <div className="item-name">{n.title}</div>
            {n.pinned && <span className="badge amber">📌 고정</span>}
          </div>
          <p className="item-sub" style={{ marginTop: 8, lineHeight: 1.5 }}>
            {n.body}
          </p>
          <div className="meta-line">
            {n.author} · {formatDate(n.created_at)}
          </div>
        </div>
      ))}

      <div className="section-title">바로가기</div>
      <div className="stat-grid">
        <Link href="/reservation" className="stat" style={{ textDecoration: "none", color: "inherit" }}>
          <div className="s-value" style={{ fontSize: 22 }}>📅</div>
          <div className="s-label" style={{ marginTop: 6 }}>연습실 예약</div>
        </Link>
        <Link href="/setlist" className="stat" style={{ textDecoration: "none", color: "inherit" }}>
          <div className="s-value" style={{ fontSize: 22 }}>🎼</div>
          <div className="s-label" style={{ marginTop: 6 }}>셋리스트 투표</div>
        </Link>
      </div>
    </>
  );
}
