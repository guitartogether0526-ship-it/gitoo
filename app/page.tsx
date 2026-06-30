import Link from "next/link";
import { getBoards, getPosts, getMembers, getSongs, getTeams } from "@/lib/db";
import { getSession } from "@/lib/session";

export const dynamic = "force-dynamic";

function formatDate(iso: string) {
  const d = new Date(iso);
  return `${d.getMonth() + 1}월 ${d.getDate()}일`;
}

export default async function DashboardPage() {
  const [session, boards, posts, members, songs, teams] = await Promise.all([
    getSession(),
    getBoards(),
    getPosts(),
    getMembers(),
    getSongs(),
    getTeams(),
  ]);

  // 공지사항 게시판의 상단 고정글만 홈에 노출
  const noticeBoardIds = new Set(boards.filter((b) => b.is_notice).map((b) => b.id));
  const pinnedNotices = posts.filter((p) => noticeBoardIds.has(p.board_id) && p.pinned);

  // 본인 팀 — 회원 테이블의 최신 배정값 우선(미배정 시 세션값)
  const me = members.find((m) => m.id === session?.id);
  const myTeamId = me?.team_id ?? session?.team_id ?? null;
  const myTeam = teams.find((t) => t.id === myTeamId);
  // 본인 팀에서 선정(확정)한 곡만 — 후보는 제외
  const myTeamSongs = songs.filter((s) => s.team_id === myTeamId && s.status === "confirmed");

  return (
    <>
      <div className="page-head">
        <h1>안녕하세요, {session?.name ?? "기타리스트"}님 🎸</h1>
        <p>오늘의 동호회 소식을 확인하세요.</p>
      </div>

      <div className="title-row" style={{ marginTop: 4 }}>
        <div className="section-title" style={{ margin: 0 }}>📢 공지사항</div>
        <Link href="/board" className="dim" style={{ fontSize: 12, textDecoration: "none" }}>
          전체보기 ›
        </Link>
      </div>

      {pinnedNotices.length === 0 ? (
        <div className="card">
          <p className="dim" style={{ margin: 0, fontSize: 13 }}>
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

      <div className="title-row" style={{ marginTop: 4 }}>
        <div className="section-title" style={{ margin: 0 }}>
          🎵 {myTeam ? `${myTeam.name} 선정곡` : "우리 팀 선정곡"}
        </div>
        <Link href="/setlist" className="dim" style={{ fontSize: 12, textDecoration: "none" }}>
          전체보기 ›
        </Link>
      </div>

      {!myTeamId ? (
        <div className="card">
          <p className="dim" style={{ margin: 0, fontSize: 13 }}>
            아직 팀이 배정되지 않았습니다. 운영진에게 팀 배정을 요청하세요.
          </p>
        </div>
      ) : myTeamSongs.length === 0 ? (
        <div className="card">
          <p className="dim" style={{ margin: 0, fontSize: 13 }}>
            아직 선정된 곡이 없습니다. 셋리스트에서 곡을 선정해 보세요.
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
            <div className="meta-line">담당 파트: {s.parts.join(" · ") || "미정"}</div>
          </div>
        ))
      )}
    </>
  );
}
