import Link from "next/link";
import { getBoards, getPosts, getMember, getSongs, getTeams, getReservations } from "@/lib/db";
import { getSession } from "@/lib/session";
import { kstYmd, kstParts } from "@/lib/date";
import NoticeCard from "@/components/NoticeCard";

export const dynamic = "force-dynamic";

const DOW = ["일", "월", "화", "수", "목", "금", "토"];

// 서버(UTC)에서 렌더되므로 KST로 변환해 표시 — 안 하면 자정~09시 글이 어제 날짜로 나온다
function formatDate(iso: string) {
  const { m, d } = kstParts(new Date(iso));
  return `${m}월 ${d}일`;
}

// 예약 날짜("YYYY-MM-DD") → "7월 2일 (목)"
function formatResDate(date: string) {
  const [y, m, d] = date.split("-").map(Number);
  const dow = DOW[new Date(y, m - 1, d).getDay()];
  return `${m}월 ${d}일 (${dow})`;
}

export default async function DashboardPage() {
  // 세션은 쿠키 읽기(네트워크 없음) — 나머지 조회는 홈에 실제로 보이는 것만 병렬로 가져온다.
  const session = await getSession();
  const todayStr = kstYmd(); // 오늘 = 한국시간 기준
  const [boards, posts, me, songs, teams, reservations] = await Promise.all([
    getBoards(),
    getPosts({ pinnedOnly: true }),
    session ? getMember(session.id) : null,
    getSongs({ confirmedOnly: true }),
    getTeams(),
    getReservations(todayStr),
  ]);

  // 공지사항 게시판의 상단 고정글만 홈에 노출
  const noticeBoardIds = new Set(boards.filter((b) => b.is_notice).map((b) => b.id));
  const pinnedNotices = posts.filter((p) => noticeBoardIds.has(p.board_id) && p.pinned);

  // 본인 팀 — 회원 테이블의 최신 배정값 우선(미배정 시 세션값). 최대 2개 팀.
  const myTeamIds = [
    me?.team_id ?? session?.team_id ?? null,
    me?.team_id_2 ?? session?.team_id_2 ?? null,
  ].filter((v): v is string => !!v);
  const myTeams = teams.filter((t) => myTeamIds.includes(t.id));
  const myTeamNames = myTeams.map((t) => t.name);
  const hasTeam = myTeams.length > 0;
  const multiTeam = myTeams.length > 1; // 2팀 소속이면 항목마다 팀명 표시(구분용)
  const teamNameById = new Map(teams.map((t) => [t.id, t.name]));
  const scheduleTitle = myTeams.length === 1 ? `${myTeams[0].name} 합주일정` : "내 합주일정";
  const songTitle = myTeams.length === 1 ? `${myTeams[0].name} 선정곡` : "우리 팀 선정곡";

  // 내 합주일정 — 본인 팀 이름으로 예약된 다가오는 일정
  const mySchedule = hasTeam
    ? reservations.filter(
        (r) =>
          myTeamNames.includes(r.reserved_by) && r.date >= todayStr && r.purpose !== "개인연습",
      )
    : [];

  // 본인 팀에서 선정(확정)한 곡만 — 후보는 제외
  const myTeamSongs = songs.filter((s) => myTeamIds.includes(s.team_id) && s.status === "confirmed");

  return (
    <>
      <div className="page-head">
        <h1>안녕하세요, {session?.name ?? "기타리스트"}님</h1>
        <p>오늘의 동호회 소식을 확인하세요.</p>
      </div>

      <div className="section-head">
        <div className="section-title">공지사항</div>
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
          <NoticeCard
            key={n.id}
            title={n.title}
            body={n.body}
            meta={`${n.author} · ${formatDate(n.created_at)}`}
            pinned
          />
        ))
      )}

      {/* 내 합주일정 (본인 팀) */}
      <div className="section-head">
        <div className="section-title">{scheduleTitle}</div>
        <Link href="/reservation" className="section-link">
          전체보기 ›
        </Link>
      </div>

      {!hasTeam ? (
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
                <div className="item-sub">
                  {multiTeam && `${r.reserved_by} · `}{r.time_label} · {r.purpose}
                </div>
              </div>
              <span className="badge amber">{r.purpose}</span>
            </div>
          </div>
        ))
      )}

      {/* 우리 팀 선정곡 */}
      <div className="section-head">
        <div className="section-title">{songTitle}</div>
        <Link href="/setlist" className="section-link">
          전체보기 ›
        </Link>
      </div>

      {!hasTeam ? (
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
                <div className="item-sub">
                  {multiTeam && `${teamNameById.get(s.team_id) ?? ""} · `}{s.artist}
                </div>
              </div>
              <span className="badge amber">★ 선정곡</span>
            </div>
            {s.youtube_url && (
              <a className="yt-link" href={s.youtube_url} target="_blank" rel="noopener noreferrer">
                ▶ 유튜브로 보기
              </a>
            )}
          </div>
        ))
      )}

      {/* 바로가기 — 제일 아래 */}
      <div className="section-title">바로가기</div>
      <div className="stat-grid">
        <Link href="/reservation" className="stat">
          <svg className="stat-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="4.5" width="18" height="16" rx="2" />
            <path d="M3 9h18M8 2.5v4M16 2.5v4" />
          </svg>
          <div className="s-label">연습실 예약</div>
        </Link>
        <Link href="/setlist" className="stat">
          <svg className="stat-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M9 18V5l11-2v13" />
            <circle cx="6" cy="18" r="3" />
            <circle cx="17" cy="16" r="3" />
          </svg>
          <div className="s-label">합주곡 투표</div>
        </Link>
      </div>
    </>
  );
}
