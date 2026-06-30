import Link from "next/link";
import { getBoards, getPosts, getMembers, getSongs, getTeams, getReservations } from "@/lib/db";
import { getSession } from "@/lib/session";

export const dynamic = "force-dynamic";

const DOW = ["일", "월", "화", "수", "목", "금", "토"];
const pad = (n: number) => String(n).padStart(2, "0");

function formatDate(iso: string) {
  const d = new Date(iso);
  return `${d.getMonth() + 1}월 ${d.getDate()}일`;
}

// 예약 날짜("YYYY-MM-DD") → "7월 2일 (목)"
function formatResDate(date: string) {
  const [y, m, d] = date.split("-").map(Number);
  const dow = DOW[new Date(y, m - 1, d).getDay()];
  return `${m}월 ${d}일 (${dow})`;
}

export default async function DashboardPage() {
  const [session, boards, posts, members, songs, teams, reservations] = await Promise.all([
    getSession(),
    getBoards(),
    getPosts(),
    getMembers(),
    getSongs(),
    getTeams(),
    getReservations(),
  ]);

  // 공지사항 게시판의 상단 고정글만 홈에 노출
  const noticeBoardIds = new Set(boards.filter((b) => b.is_notice).map((b) => b.id));
  const pinnedNotices = posts.filter((p) => noticeBoardIds.has(p.board_id) && p.pinned);

  // 본인 팀 — 회원 테이블의 최신 배정값 우선(미배정 시 세션값)
  const me = members.find((m) => m.id === session?.id);
  const myTeamId = me?.team_id ?? session?.team_id ?? null;
  const myTeam = teams.find((t) => t.id === myTeamId);

  // 내 합주일정 — 본인 팀 이름으로 예약된 다가오는 일정
  const now = new Date();
  const todayStr = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
  const mySchedule = myTeam
    ? reservations.filter(
        (r) => r.reserved_by === myTeam.name && r.date >= todayStr && r.purpose !== "개인연습",
      )
    : [];

  // 본인 팀에서 선정(확정)한 곡만 — 후보는 제외
  const myTeamSongs = songs.filter((s) => s.team_id === myTeamId && s.status === "confirmed");

  return (
    <>
      <div className="page-head">
        <h1>안녕하세요, {session?.name ?? "기타리스트"}님 🎸</h1>
        <p>오늘의 동호회 소식을 확인하세요.</p>
      </div>

      <div className="section-head">
        <div className="section-title">📢 공지사항</div>
        <Link href="/board" className="section-link">
          전체보기 ›
        </Link>
      </div>

      {pinnedNotices.length === 0 ? (
        <div className="card">
          <p className="empty-msg">
            상단 고정된 공지가 없습니다.
          </p>
        </div>
      ) : (
        pinnedNotices.map((n) => (
          <div className="card" key={n.id}>
            <div className="title-row">
              <div className="item-name">{n.title}</div>
              <span className="badge amber">📌 고정</span>
            </div>
            <p className="item-sub" style={{ marginTop: 8, lineHeight: 1.5, whiteSpace: "pre-wrap" }}>
              {n.body}
            </p>
            <div className="meta-line">
              {n.author} · {formatDate(n.created_at)}
            </div>
          </div>
        ))
      )}

      {/* 내 합주일정 (본인 팀) */}
      <div className="section-head">
        <div className="section-title">
          🥁 {myTeam ? `${myTeam.name} 합주일정` : "내 합주일정"}
        </div>
        <Link href="/reservation" className="section-link">
          전체보기 ›
        </Link>
      </div>

      {!myTeamId ? (
        <div className="card">
          <p className="empty-msg">
            합주일정이 없습니다.
          </p>
        </div>
      ) : mySchedule.length === 0 ? (
        <div className="card">
          <p className="empty-msg">
            예정된 합주일정이 없습니다.
          </p>
        </div>
      ) : (
        mySchedule.map((r) => (
          <div className="card" key={r.id}>
            <div className="title-row">
              <div className="grow">
                <span className="item-name">{formatResDate(r.date)}</span>
                <div className="item-sub">{r.time_label} · {r.purpose}</div>
              </div>
              <span className="badge amber">🥁 합주</span>
            </div>
          </div>
        ))
      )}

      {/* 우리 팀 선정곡 */}
      <div className="section-head">
        <div className="section-title">
          🎵 {myTeam ? `${myTeam.name} 선정곡` : "우리 팀 선정곡"}
        </div>
        <Link href="/setlist" className="section-link">
          전체보기 ›
        </Link>
      </div>

      {!myTeamId ? (
        <div className="card">
          <p className="empty-msg">
            아직 팀이 배정되지 않았습니다. 운영진에게 팀 배정을 요청하세요.
          </p>
        </div>
      ) : myTeamSongs.length === 0 ? (
        <div className="card">
          <p className="empty-msg">
            아직 선정된 곡이 없습니다. 합주곡에서 곡을 선정해 보세요.
          </p>
        </div>
      ) : (
        myTeamSongs.map((s) => (
          <div className="card" key={s.id}>
            <div className="title-row">
              <div className="grow">
                <span className="item-name">{s.title}</span>
                <div className="item-sub">{s.artist}</div>
              </div>
              <span className="badge amber">★ 선정곡</span>
            </div>
            {s.youtube_url && (
              <div className="sheet-links">
                <a className="sheet-link" href={s.youtube_url} target="_blank" rel="noopener noreferrer">
                  ▶ 유튜브로 보기
                </a>
              </div>
            )}
          </div>
        ))
      )}

      {/* 바로가기 — 제일 아래 */}
      <div className="section-title">바로가기</div>
      <div className="stat-grid">
        <Link href="/reservation" className="stat">
          <div className="s-value" style={{ fontSize: 26 }}>📅</div>
          <div className="s-label">연습실 예약</div>
        </Link>
        <Link href="/setlist" className="stat">
          <div className="s-value" style={{ fontSize: 26 }}>🎼</div>
          <div className="s-label">합주곡 투표</div>
        </Link>
      </div>
    </>
  );
}
