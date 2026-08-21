"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { type Song, type Team, type TeamCategory, TEAM_CATEGORIES, teamCategory } from "@/lib/types";
import { getSupabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth";
import { can } from "@/lib/roles";
import { addTeam, saveTeams as saveTeamsAction, deleteTeam } from "@/lib/team-actions";
import { setSongStatus, toggleSongVote } from "@/lib/song-actions";
import { sendSongPush } from "@/lib/push-actions";
import { useRefreshHold } from "@/lib/refresh-hold";
import { useSyncedState } from "@/lib/use-synced-state";

type MemberLite = {
  id: string;
  name: string;
  part: string;
  part2?: string | null;
  part3?: string | null;
  team_id: string | null;
  team_id_2: string | null;
  team_id_3: string | null;
};

const HeartIcon = ({ filled }: { filled: boolean }) => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill={filled ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 20s-7-4.6-9.3-9.1C1.2 8 2.5 5 5.5 5c1.9 0 3 1 2.5 1S10 5 12 7c2-2 4-2 4-2s.6 0 2.5 0c3 0 4.3 3 2.8 5.9C19 15.4 12 20 12 20Z" />
  </svg>
);

// 유튜브 링크에서 영상 id — 썸네일(img.youtube.com)에 쓴다. 못 찾으면 null
const ytId = (u?: string | null): string | null => {
  if (!u) return null;
  const m = u.match(/(?:youtu\.be\/|v=|embed\/|shorts\/)([\w-]{11})/);
  return m ? m[1] : null;
};

// 스킴 없는 링크도 새창에서 열리도록 보정
const normalizeUrl = (u: string) => {
  const t = u.trim();
  if (!t) return "";
  return /^https?:\/\//i.test(t) ? t : `https://${t}`;
};

export default function SetlistView({
  teams,
  initial,
  myTeamIds,
  members,
}: {
  teams: Team[];
  initial: Song[];
  myTeamIds: string[]; // 본인 소속 팀(최대 3개)
  members: MemberLite[];
}) {
  const { user } = useAuth();
  const router = useRouter();
  const canManageTeams = can.manageTeams(user?.role);

  // 다른 사람이 올린 곡/투표 등 서버 최신 데이터를 반영하되, 내용이 같으면 리렌더 없음
  const [teamList, setTeamList] = useSyncedState<Team[]>(teams);
  const [songs, setSongs] = useSyncedState<Song[]>(initial);

  // 페이지 구분(정기공연/재롱페스티벌) + 선택한 팀 탭.
  // 페이지 이동·앱 재로드로 다시 마운트돼도 마지막에 보던 팀 유지(구분은 그 팀에서 역산).
  // SSR에는 localStorage가 없어(하이드레이션 불일치 방지) 마운트 후 복원한다.
  const [activeTeam, setActiveTeamState] = useState<string>(teams[0]?.id ?? "");
  const [activeCat, setActiveCat] = useState<TeamCategory>(
    teams[0] ? teamCategory(teams[0]) : "정기공연",
  );
  useEffect(() => {
    const saved = window.localStorage.getItem("setlist-team");
    const t = teams.find((x) => x.id === saved);
    if (t) {
      setActiveTeamState(t.id);
      setActiveCat(teamCategory(t));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const setActiveTeam = (id: string) => {
    setActiveTeamState(id);
    try {
      if (id) window.localStorage.setItem("setlist-team", id);
    } catch {}
  };

  // 현재 페이지의 팀 탭 — 구분을 바꾸면 그 페이지의 첫 팀으로 이동
  const catTeams = teamList.filter((t) => teamCategory(t) === activeCat);
  const switchCat = (c: TeamCategory) => {
    setActiveCat(c);
    setActiveTeam(teamList.find((t) => teamCategory(t) === c)?.id ?? "");
  };

  // 현재 보고 있는 팀을 관리할 수 있는가 (본인 소속 팀 또는 운영진)
  const canManageActive = canManageTeams || myTeamIds.includes(activeTeam);

  // 재롱페스티벌 — 팀 탭·좋아요·선정곡/후보·유튜브 없이 "곡명 - 참여인원" 한 줄 목록.
  // 참여인원은 회원 이름을 골라 ", " 로 이어 붙인 문자열이라 songs.artist 칸을 그대로 쓴다(컬럼 추가 없음).
  const isFestival = activeCat === "재롱페스티벌";
  // 올리기는 로그인 회원 누구나, 고치고 지우는 건 운영진 또는 올린 본인
  const canAdd = isFestival ? !!user : canManageActive;
  const canEditSong = (s: Song) =>
    isFestival
      ? canManageTeams || (!!s.created_by && s.created_by === user?.name)
      : canManageActive;

  // 곡 올리기 폼
  const [title, setTitle] = useState("");
  const [artist, setArtist] = useState("");
  const [youtube, setYoutube] = useState("");
  const [showForm, setShowForm] = useState(false);

  // 곡 수정 폼
  const [editId, setEditId] = useState("");
  const [eTitle, setETitle] = useState("");
  const [eArtist, setEArtist] = useState("");
  const [eYoutube, setEYoutube] = useState("");
  const [eCreatedBy, setECreatedBy] = useState(""); // 기존 곡은 작성자 기록이 없어 수정 폼으로 채운다

  // 팀 수정 팝업 (운영진)
  const [showTeamModal, setShowTeamModal] = useState(false);
  const [draft, setDraft] = useState<Team[]>([]);
  const [newTeam, setNewTeam] = useState("");
  const [teamBusy, setTeamBusy] = useState(false);
  const [teamError, setTeamError] = useState("");

  // 팀원 보기 팝업 (전체)
  const [showMembers, setShowMembers] = useState(false);

  // 접이식 후보곡 카드 — 펼쳐진 곡 id 집합 (선정곡은 항상 펼침)
  const [openIds, setOpenIds] = useState<Set<string>>(new Set());
  const toggleOpen = (id: string) =>
    setOpenIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  // 곡 올리기/수정 폼·팀 수정 팝업이 열려 있는 동안 자동 동기화 보류
  useRefreshHold(showForm || editId !== "" || showTeamModal);

  const openTeamModal = () => {
    setDraft(teamList.map((t) => ({ ...t })));
    setNewTeam("");
    setTeamError("");
    setShowTeamModal(true);
  };

  // ▲▼ 는 같은 페이지(구분) 안에서만 자리를 바꾼다 — a·b 는 draft 인덱스
  const swapTeam = (a: number, b: number) =>
    setDraft((prev) => {
      const next = [...prev];
      [next[a], next[b]] = [next[b], next[a]];
      return next;
    });
  const setDraftName = (i: number, name: string) =>
    setDraft((prev) => prev.map((t, idx) => (idx === i ? { ...t, name } : t)));

  const addTeamInModal = async () => {
    setTeamError("");
    const name = newTeam.trim();
    if (!name) return;
    setTeamBusy(true);
    const res = await addTeam(name, "정기공연"); // 팀 관리는 정기공연 전용 (재롱은 팀 없음)
    setTeamBusy(false);
    if ("error" in res) {
      setTeamError(res.error);
      return;
    }
    setDraft((prev) => [...prev, res.team]);
    setTeamList((prev) => [...prev, res.team]);
    setNewTeam("");
  };

  // 팀 삭제 — 추가와 동일하게 즉시 반영(저장 버튼 대기 없음)
  const removeTeamInModal = (t: Team) => {
    setTeamError("");
    const n = songs.filter((s) => s.team_id === t.id).length;
    setConfirmAsk({
      msg: `"${t.name}" 팀을 삭제할까요?
이 팀의 곡 ${n}개도 함께 삭제되고, 팀원은 미배정이 됩니다. 되돌릴 수 없습니다.`,
      onOk: async () => {
        setTeamBusy(true);
        const res = await deleteTeam(t.id);
        setTeamBusy(false);
        if ("error" in res) {
          setTeamError(res.error);
          return;
        }
        setDraft((prev) => prev.filter((x) => x.id !== t.id));
        setTeamList((prev) => prev.filter((x) => x.id !== t.id));
        setSongs((prev) => prev.filter((s) => s.team_id !== t.id));
        if (activeTeam === t.id)
          setActiveTeam(
            teamList.find((x) => x.id !== t.id && teamCategory(x) === activeCat)?.id ?? "",
          );
      },
    });
  };

  // 팝업에서 보여줄 행 — draft 원본 인덱스(i)를 함께 들고 있어야 ▲▼·수정이 정확히 꽂힌다
  const modalRows = draft.map((t, i) => ({ t, i })).filter(({ t }) => teamCategory(t) === "정기공연");

  const saveTeams = async () => {
    setTeamError("");
    if (draft.some((t) => !t.name.trim())) {
      setTeamError("팀 이름은 비울 수 없습니다.");
      return;
    }
    setTeamBusy(true);
    // 이름·페이지 구분·순서를 한 번에 저장 (배열 순서 = sort_order)
    const res = await saveTeamsAction(
      draft.map((t) => ({ id: t.id, name: t.name.trim(), category: teamCategory(t) })),
    );
    setTeamBusy(false);
    if ("error" in res) {
      // 저장 실패를 성공처럼 닫지 않는다 — 모달 유지 + 오류 표시
      setTeamError(res.error);
      return;
    }
    setTeamList(
      draft.map((t, i) => ({ ...t, name: t.name.trim(), category: teamCategory(t), sort_order: i })),
    );
    setShowTeamModal(false);
    // 옮긴 팀이 지금 보는 페이지에서 사라졌으면 첫 팀으로
    if (!draft.some((t) => t.id === activeTeam && teamCategory(t) === activeCat))
      setActiveTeam(draft.find((t) => teamCategory(t) === activeCat)?.id ?? "");
  };

  // 정렬 — 기본 가나다순, 토글 시 좋아요 많은 순(동률은 가나다순)
  const [sortByLikes, setSortByLikes] = useState(false);

  // 표시할 곡: 본인팀/운영진은 전체, 다른 팀은 선정곡만
  const teamSongs = useMemo(
    () =>
      songs
        .filter((s) => s.team_id === activeTeam)
        .filter((s) => isFestival || canManageActive || s.status === "confirmed")
        .sort((a, b) =>
          sortByLikes
            ? b.likes - a.likes || a.title.localeCompare(b.title, "ko")
            : a.title.localeCompare(b.title, "ko"),
        ),
    [songs, activeTeam, canManageActive, sortByLikes],
  );

  // 선정곡을 위로 — 팀원이 이 화면에 오는 첫 이유가 목록 중간에 파묻히지 않게 나눠 그린다
  const confirmedSongs = teamSongs.filter((s) => s.status === "confirmed");
  const candidateSongs = teamSongs.filter((s) => s.status !== "confirmed");

  const activeTeamName = teamList.find((t) => t.id === activeTeam)?.name ?? "";
  const activeMembers = members
    .filter(
      (m) =>
        m.team_id === activeTeam || m.team_id_2 === activeTeam || m.team_id_3 === activeTeam,
    )
    .sort((a, b) => a.name.localeCompare(b.name, "ko"));

  const sortedMembers = useMemo(
    () => members.slice().sort((a, b) => a.name.localeCompare(b.name, "ko")),
    [members],
  );

  const teamSize = activeMembers.length; // 좋아요를 "N/팀원수" 로 보여주기 위한 분모

  // 참여인원 고르기 — 이름 목록 문자열("A, B")을 토글한다. 별도 상태 없이 artist 칸을 그대로 쓴다.
  const names = (v: string) => v.split(",").map((n) => n.trim()).filter(Boolean);
  const toggleName = (cur: string, set: (v: string) => void, name: string) => {
    const list = names(cur);
    set((list.includes(name) ? list.filter((n) => n !== name) : [...list, name]).join(", "));
  };
  // 이름 선택 칩 — 곡 올리기·수정 폼에서 같은 모양으로 쓴다
  const memberPicker = (value: string, onChange: (v: string) => void) => (
    <div className="field">
      <label>참여인원 ({names(value).length}명)</label>
      <div className="tab-row wrap">
        {sortedMembers.map((m) => (
          <button
            key={m.id}
            type="button"
            className={`tab${names(value).includes(m.name) ? " active" : ""}`}
            onClick={() => toggleName(value, onChange, m.name)}
            aria-pressed={names(value).includes(m.name)}
          >
            {m.name}
          </button>
        ))}
      </div>
    </div>
  );

  const onAddKey = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") addSong();
  };

  // 좋아요 — 회원별 1인 1투표 (서버 액션이 song_votes에 저장, 확정값 반환)
  const [likeBusy, setLikeBusy] = useState(false);
  const toggleLike = async (id: string) => {
    if (!canManageActive || likeBusy) return; // 다른 팀은 투표 불가 · 연타 중복 요청 방지
    const cur = songs.find((s) => s.id === id);
    if (!cur) return;
    setLikeBusy(true);
    const nextVoted = !cur.voted;
    setSongs((prev) =>
      prev.map((s) =>
        s.id === id ? { ...s, voted: nextVoted, likes: s.likes + (nextVoted ? 1 : -1) } : s,
      ),
    );
    const res = await toggleSongVote(id);
    setLikeBusy(false);
    if ("error" in res) {
      // 저장 실패 — 화면 원복
      setSongs((prev) =>
        prev.map((s) => (s.id === id ? { ...s, voted: cur.voted, likes: cur.likes } : s)),
      );
      setNotice(res.error);
    } else {
      // 서버 확정값으로 동기화 (다른 회원 투표까지 반영된 수)
      setSongs((prev) =>
        prev.map((s) => (s.id === id ? { ...s, voted: res.voted, likes: res.likes } : s)),
      );
    }
  };

  // 곡 선정/후보 저장 (서버 액션) + 완료 팝업
  const [statusBusy, setStatusBusy] = useState("");
  const [notice, setNotice] = useState(""); // 저장 결과·오류 공용 안내 (alert 대신 앱 팝업)
  const [addBusy, setAddBusy] = useState(false); // 곡 등록 연타 방지
  // 삭제 확인 팝업 — window.confirm 대신 앱 안에서 물어본다
  const [confirmAsk, setConfirmAsk] = useState<{ msg: string; onOk: () => void } | null>(null);

  const changeStatus = async (id: string, next: "confirmed" | "candidate") => {
    if (!canManageActive) return;
    setStatusBusy(id);
    const res = await setSongStatus(id, next);
    setStatusBusy("");
    if ("error" in res) {
      setNotice(res.error);
      return;
    }
    setSongs((prev) => prev.map((s) => (s.id === id ? { ...s, status: next } : s)));
    setNotice(next === "confirmed" ? "선정곡으로 저장했습니다." : "후보로 되돌렸습니다.");
    router.refresh();
  };

  const addSong = async () => {
    if (!canAdd || addBusy || !title.trim() || !artist.trim()) return;
    setAddBusy(true);
    const payload = {
      team_id: activeTeam,
      title: title.trim(),
      artist: artist.trim(),
      youtube_url: normalizeUrl(youtube) || null,
      likes: 0,
      voted: false,
      status: "candidate" as const,
      created_by: user?.name ?? null,
    };
    const sb = getSupabase();
    if (sb) {
      let res = await sb.from("songs").insert(payload).select().single();
      if (res.error) {
        // 컬럼 미생성(schema.sql 미실행) DB 대응 — 새 컬럼을 빼고 재시도
        const { youtube_url: _yt, created_by: _cb, ...rest } = payload;
        res = await sb.from("songs").insert(rest).select().single();
      }
      if (res.error || !res.data) {
        // 저장 실패 — 입력값을 지우지 않고 알린다
        setAddBusy(false);
        setNotice("곡 저장에 실패했습니다. 잠시 후 다시 시도해 주세요.");
        return;
      }
      setSongs((prev) => [...prev, res.data as Song]);
      // 같은 팀 소속 회원에게만 푸시 알림 (올린 본인 제외) — 재롱은 팀 개념이 없어 생략
      if (!isFestival) void sendSongPush(activeTeam, payload.title, payload.artist);
      router.refresh();
    } else {
      setSongs((prev) => [...prev, { id: `song-${activeTeam}-${prev.length}`, ...payload }]);
    }
    setAddBusy(false);
    setTitle("");
    setArtist("");
    setYoutube("");
    setShowForm(false);
    setNotice(`"${payload.title}" 을(를) ${isFestival ? "목록에 추가했습니다" : "후보곡으로 올렸습니다"}.`);
  };

  const startEdit = (s: Song) => {
    setEditId(s.id);
    setETitle(s.title);
    setEArtist(s.artist);
    setEYoutube(s.youtube_url ?? "");
    setECreatedBy(s.created_by ?? "");
  };
  const cancelEdit = () => setEditId("");

  const saveEdit = async (id: string) => {
    if (!eTitle.trim() || !eArtist.trim()) return;
    const patch = {
      title: eTitle.trim(),
      artist: eArtist.trim(),
      youtube_url: normalizeUrl(eYoutube) || null,
      created_by: eCreatedBy.trim() || null,
    };
    setSongs((prev) => prev.map((s) => (s.id === id ? { ...s, ...patch } : s)));
    setEditId("");
    const sb = getSupabase();
    if (sb) {
      const { error } = await sb.from("songs").update(patch).eq("id", id);
      if (error) await sb.from("songs").update({ title: patch.title, artist: patch.artist }).eq("id", id);
      router.refresh();
    }
  };

  const deleteSong = (id: string) => {
    const song = songs.find((s) => s.id === id);
    if (!song || !canEditSong(song)) return;
    setConfirmAsk({
      msg: `"${song.title}" 을(를) 삭제할까요?
되돌릴 수 없습니다.`,
      onOk: async () => {
        setSongs((prev) => prev.filter((s) => s.id !== id));
        if (editId === id) setEditId("");
        const sb = getSupabase();
        if (sb) {
          await sb.from("songs").delete().eq("id", id);
          router.refresh();
        }
      },
    });
  };

  // 재롱페스티벌 한 줄 — 왼쪽 곡명, 오른쪽 참여인원
  const renderFestivalRow = (s: Song) =>
    editId === s.id ? (
      <div className="res-item" key={s.id} style={{ display: "block" }}>
        <div className="form-grid">
          <div className="field">
            <label>곡명</label>
            <input className="input" value={eTitle} onChange={(e) => setETitle(e.target.value)} />
          </div>
          {memberPicker(eArtist, setEArtist)}
          <div className="btn-row">
            <button className="btn amber btn-sm" onClick={() => saveEdit(s.id)}>저장</button>
            <button className="btn ghost btn-sm" onClick={cancelEdit}>취소</button>
          </div>
        </div>
      </div>
    ) : (
      <div className="res-item" key={s.id}>
        <span className="item-name grow">{s.title}</span>
        <span className="item-sub" style={{ margin: 0, textAlign: "right" }}>{s.artist}</span>
        {canEditSong(s) && (
          <>
            <button className="btn ghost btn-sm" onClick={() => startEdit(s)}>수정</button>
            <button className="btn danger btn-sm" onClick={() => deleteSong(s.id)}>삭제</button>
          </>
        )}
      </div>
    );

  // 곡 카드 1개 — 선정곡/후보곡 두 섹션에서 같은 모양으로 쓴다
  const renderSong = (s: Song) =>
    editId === s.id ? (
      <div className="card" key={s.id}>
        <div className="form-grid">
          <div className="field">
            <label>곡 제목</label>
            <input className="input" value={eTitle} onChange={(e) => setETitle(e.target.value)} />
          </div>
          <div className="field">
            <label>아티스트명</label>
            <input className="input" value={eArtist} onChange={(e) => setEArtist(e.target.value)} />
          </div>
          <div className="field">
            <label>유튜브 링크</label>
            <input className="input" type="url" inputMode="url" value={eYoutube} onChange={(e) => setEYoutube(e.target.value)} placeholder="https://youtu.be/..." autoCapitalize="none" />
          </div>
          {/* 올린 사람은 기존 곡 보정용 — 운영진만 고칠 수 있게 */}
          {canManageTeams && (
            <div className="field">
              <label>올린 사람 (운영진만 수정 가능)</label>
              <input className="input" value={eCreatedBy} onChange={(e) => setECreatedBy(e.target.value)} placeholder="예: 홍길동 (기존 곡은 비어 있어요)" maxLength={20} />
            </div>
          )}
          <div className="btn-row">
            <button className="btn amber btn-sm" onClick={() => saveEdit(s.id)}>저장</button>
            <button className="btn ghost btn-sm" onClick={cancelEdit}>취소</button>
          </div>
        </div>
      </div>
    ) : (
      // 선정곡 = 항상 펼침(기존 카드 그대로) · 후보곡 = 접이식(헤더 탭으로 토글)
      (() => {
        const isConfirmed = s.status === "confirmed";
        const isOpen = isConfirmed || openIds.has(s.id);
        return (
          <div className="card" key={s.id}>
            <div
              className="title-row"
              onClick={isConfirmed ? undefined : () => toggleOpen(s.id)}
              style={isConfirmed ? undefined : { cursor: "pointer" }}
              aria-expanded={isConfirmed ? undefined : isOpen}
            >
              <div className="grow">
                {isOpen ? (
                  <>
                    <div className="flex items-center gap-8" style={{ flexWrap: "wrap" }}>
                      <span className="item-name">{s.title}</span>
                      <span className={`badge ${isConfirmed ? "amber" : ""}`}>
                        {isConfirmed ? "★ 선정곡" : "후보"}
                      </span>
                    </div>
                    <div className="item-sub">
                      {s.artist}
                      {s.created_by && <span className="dim"> · 올린이 {s.created_by}</span>}
                    </div>
                  </>
                ) : (
                  // 접힌 상태 — 곡명 - 아티스트 한 줄
                  <div className="flex items-center gap-8" style={{ flexWrap: "wrap" }}>
                    <span className="item-name">{s.title}</span>
                    <span className="item-sub" style={{ margin: 0 }}>- {s.artist}</span>
                  </div>
                )}
              </div>
              {canManageActive ? (
                <button
                  className={`like-btn${s.voted ? " liked" : ""}`}
                  onClick={(e) => {
                    e.stopPropagation(); // 좋아요 탭이 접기/펼치기로 번지지 않게
                    toggleLike(s.id);
                  }}
                  aria-pressed={s.voted}
                  aria-label={`좋아요 ${s.likes}${teamSize ? ` / 팀원 ${teamSize}명` : ""}`}
                >
                  <HeartIcon filled={s.voted} />
                  {s.likes}
                  {teamSize > 0 && <span className="like-total">/{teamSize}</span>}
                </button>
              ) : (
                // 다른 팀은 투표 불가 — 눌리는 버튼처럼 보이지 않게 숫자만 보여준다
                <span className="like-count">
                  <HeartIcon filled={false} />
                  {s.likes}
                </span>
              )}
              {!isConfirmed && (
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  style={{
                    flexShrink: 0,
                    alignSelf: "center",
                    opacity: 0.5,
                    transform: isOpen ? "rotate(180deg)" : undefined,
                    transition: "transform .15s",
                  }}
                >
                  <path d="M6 9l6 6 6-6" />
                </svg>
              )}
            </div>

            {isOpen && (
              <>
                {s.youtube_url &&
                  (ytId(s.youtube_url) ? (
                    <a href={s.youtube_url} target="_blank" rel="noopener noreferrer" aria-label={`${s.title} 유튜브로 보기`}>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        className="yt-thumb"
                        src={`https://img.youtube.com/vi/${ytId(s.youtube_url)}/mqdefault.jpg`}
                        alt=""
                        loading="lazy"
                        // 오프라인·삭제된 영상이면 깨진 이미지 대신 숨긴다
                        onError={(e) => {
                          e.currentTarget.style.display = "none";
                        }}
                      />
                    </a>
                  ) : (
                    <a className="yt-link" href={s.youtube_url} target="_blank" rel="noopener noreferrer">
                      ▶ 유튜브로 보기
                    </a>
                  ))}

                {canManageActive && (
                  <div className="btn-row" style={{ marginTop: 8 }}>
                    {isConfirmed ? (
                      <button className="btn ghost btn-sm" disabled={statusBusy === s.id} onClick={() => changeStatus(s.id, "candidate")}>
                        {statusBusy === s.id ? "저장 중…" : "후보로 되돌리기"}
                      </button>
                    ) : (
                      <button className="btn amber btn-sm" disabled={statusBusy === s.id} onClick={() => changeStatus(s.id, "confirmed")}>
                        {statusBusy === s.id ? "저장 중…" : "★ 선정곡으로 하기"}
                      </button>
                    )}
                    <button className="btn ghost btn-sm" onClick={() => startEdit(s)}>수정</button>
                    <button className="btn danger btn-sm" onClick={() => deleteSong(s.id)}>삭제</button>
                  </div>
                )}
              </>
            )}
          </div>
        );
      })()
    );

  return (
    <>
      {/* 페이지 구분 — 정기공연 / 재롱페스티벌 */}
      <div className="tab-row seg">
        {TEAM_CATEGORIES.map((c) => (
          <button
            key={c}
            className={`tab${activeCat === c ? " active" : ""}`}
            onClick={() => switchCat(c)}
          >
            {c}
          </button>
        ))}
      </div>

      {/* 팀별 탭 — 4개씩 줄바꿈 (1~4팀 / 5~8팀) */}
      {!isFestival && (
      <div className="tab-row wrap">
        {catTeams.map((t) => (
          <button
            key={t.id}
            className={`tab${activeTeam === t.id ? " active" : ""}`}
            onClick={() => setActiveTeam(t.id)}
          >
            {t.name}
            {/* 본인 소속 팀 표시 — 팀이 많아도 내 탭을 바로 찾도록 */}
            {myTeamIds.includes(t.id) && <span className="tab-dot" aria-label="내 팀" />}
          </button>
        ))}
      </div>
      )}

      {!isFestival && catTeams.length === 0 && (
        <div className="card">
          <p className="dim" style={{ margin: 0, fontSize: 13 }}>
            {activeCat} 팀이 아직 없습니다.
            {canManageTeams ? " 아래 '팀 수정'에서 추가하세요." : " 운영진에게 문의하세요."}
          </p>
        </div>
      )}

      {/* 팀 도구 버튼 */}
      {!isFestival && (
      <div className="flex items-center gap-8" style={{ marginTop: 8 }}>
        {!!activeTeam && (
          <button className="btn ghost btn-sm" onClick={() => setShowMembers(true)}>
            팀원 보기 ({teamSize})
          </button>
        )}
        {canManageTeams && (
          <button className="btn ghost btn-sm" onClick={openTeamModal}>
            팀 수정
          </button>
        )}
      </div>
      )}

      {/* 곡 올리기 — 본인팀/운영진만 */}
      {canAdd && !!activeTeam && (
        <>
          <button className="btn amber" style={{ width: "100%", marginTop: 8 }} onClick={() => setShowForm((v) => !v)}>
            {showForm ? "닫기" : isFestival ? "＋ 곡 추가" : "＋ 곡 올리기"}
          </button>

          {showForm && (
            <div className="card mt-12">
              <div className="form-grid">
                <div className="field">
                  <label>곡 제목</label>
                  <input className="input" value={title} onChange={(e) => setTitle(e.target.value)} onKeyDown={onAddKey} placeholder="곡 제목" />
                </div>
                {isFestival ? (
                  memberPicker(artist, setArtist)
                ) : (
                <div className="field">
                  <label>아티스트명</label>
                  <input className="input" value={artist} onChange={(e) => setArtist(e.target.value)} onKeyDown={onAddKey} placeholder="아티스트명" />
                </div>
                )}
                {!isFestival && (
                <div className="field">
                  <label>유튜브 링크</label>
                  <input
                    className="input"
                    type="url"
                    inputMode="url"
                    value={youtube}
                    onChange={(e) => setYoutube(e.target.value)}
                    onKeyDown={onAddKey}
                    placeholder="https://youtu.be/..."
                    autoCapitalize="none"
                  />
                </div>
                )}
                <button className="btn amber" disabled={addBusy || !title.trim() || !artist.trim()} onClick={addSong}>
                  {addBusy ? "올리는 중…" : isFestival ? "목록에 추가" : "합주곡에 올리기"}
                </button>
              </div>
            </div>
          )}
        </>
      )}

      {/* 곡 목록 — 팀이 없는 페이지에서는 감춘다 */}
      {!!activeTeam && (
        <>
      {isFestival ? (
        // 재롱페스티벌 — 곡명 / 참여인원 한 줄 목록
        <>
          <div className="section-title">재롱페스티벌 ({teamSongs.length})</div>
          <div className="card">
            {teamSongs.length === 0 ? (
              <p className="dim" style={{ margin: 0, fontSize: 13 }}>아직 등록된 곡이 없습니다.</p>
            ) : (
              teamSongs.map(renderFestivalRow)
            )}
          </div>
        </>
      ) : (
        <>
      <div className="section-title flex items-center" style={{ justifyContent: "space-between", gap: 8 }}>
        <span>
          {activeTeamName} 합주곡 ({teamSongs.length})
          {!canManageActive && <span className="dim" style={{ fontSize: 12, fontWeight: 400 }}> · 선정곡만 표시</span>}
        </span>
        <button
          className="btn ghost btn-sm"
          style={{ flexShrink: 0 }}
          onClick={() => setSortByLikes((v) => !v)}
          aria-pressed={sortByLikes}
        >
          {sortByLikes ? "가나다순 보기" : "좋아요순 보기"}
        </button>
      </div>

      {teamSongs.length === 0 ? (
        <div className="card">
          <p className="dim" style={{ margin: 0, fontSize: 13 }}>
            {canManageActive ? "아직 올라온 곡이 없습니다. 위에서 곡을 올려보세요." : "아직 공개된 선정곡이 없습니다."}
          </p>
        </div>
      ) : (
        <>
          {confirmedSongs.length > 0 && (
            <div className="list-sub">★ 선정곡 ({confirmedSongs.length})</div>
          )}
          {confirmedSongs.map(renderSong)}
          {candidateSongs.length > 0 && (
            <div className="list-sub">후보곡 ({candidateSongs.length})</div>
          )}
          {candidateSongs.map(renderSong)}
        </>
      )}

      <p className="dim" style={{ fontSize: 12, textAlign: "center", marginTop: 8 }}>
        본인 팀 곡은 올리기·수정·삭제·선정이 가능하고, 다른 팀은 선정곡만 볼 수 있어요. (운영진은 전체 관리)
      </p>
        </>
      )}
        </>
      )}

      {/* 선정/후보 저장 결과 팝업 */}
      {notice && (
        <div className="modal-overlay" onClick={() => setNotice("")}>
          <div className="card" style={{ margin: 0, width: "100%", maxWidth: 360, textAlign: "center" }} onClick={(e) => e.stopPropagation()}>
            <p style={{ fontWeight: 700, margin: "4px 0 12px", fontSize: 15 }}>{notice}</p>
            <button className="btn amber" style={{ width: "100%" }} onClick={() => setNotice("")}>확인</button>
          </div>
        </div>
      )}

      {/* 삭제 확인 팝업 — 브라우저 기본 confirm 대신 앱 팝업으로 통일 */}
      {confirmAsk && (
        <div className="modal-overlay" onClick={() => setConfirmAsk(null)}>
          <div className="card" style={{ margin: 0, width: "100%", maxWidth: 360 }} onClick={(e) => e.stopPropagation()}>
            <p style={{ margin: "4px 0 14px", fontSize: 14, lineHeight: 1.6, whiteSpace: "pre-line" }}>
              {confirmAsk.msg}
            </p>
            <div className="btn-row">
              <button
                className="btn danger"
                style={{ flex: 1 }}
                onClick={() => {
                  const ok = confirmAsk.onOk;
                  setConfirmAsk(null);
                  ok();
                }}
              >
                삭제
              </button>
              <button className="btn ghost" style={{ flex: 1 }} onClick={() => setConfirmAsk(null)}>
                취소
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 팀원 보기 팝업 */}
      {showMembers && (
        <div className="modal-overlay" onClick={() => setShowMembers(false)}>
          <div className="card" style={{ margin: 0, width: "100%", maxWidth: 420, maxHeight: "80vh", overflowY: "auto" }} onClick={(e) => e.stopPropagation()}>
            <div className="title-row">
              <div className="section-title" style={{ margin: 0 }}>{activeTeamName} 팀원 ({activeMembers.length})</div>
              <button className="btn ghost btn-sm" onClick={() => setShowMembers(false)}>닫기</button>
            </div>
            {activeMembers.length === 0 ? (
              <p className="dim" style={{ fontSize: 13, marginBottom: 0 }}>이 팀에 배정된 회원이 없습니다.</p>
            ) : (
              <div style={{ marginTop: 8 }}>
                {activeMembers.map((m) => (
                  <div key={m.id} className="res-item">
                    <span className="m-name">{m.name}</span>
                    {/* 그 팀에 해당하는 악기 — 악기2·3이 비면 악기1 */}
                    <span className="dim" style={{ fontSize: 13 }}>
                      {m.team_id === activeTeam
                        ? m.part
                        : m.team_id_2 === activeTeam
                          ? m.part2 || m.part
                          : m.part3 || m.part}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* 팀 수정 팝업 (운영진) */}
      {showTeamModal && (
        <div className="modal-overlay" onClick={() => !teamBusy && setShowTeamModal(false)}>
          <div className="card" style={{ margin: 0, width: "100%", maxWidth: 440, maxHeight: "85vh", overflowY: "auto" }} onClick={(e) => e.stopPropagation()}>
            <div className="title-row">
              <div className="section-title" style={{ margin: 0 }}>팀 수정</div>
              <button className="btn ghost btn-sm" onClick={() => setShowTeamModal(false)}>닫기</button>
            </div>
            <p className="dim" style={{ fontSize: 12, marginTop: 4 }}>이름을 고치고 ▲▼로 순서를 바꾼 뒤 저장하세요. 추가·삭제는 즉시 반영됩니다.</p>

            <div style={{ marginTop: 8 }}>
              {modalRows.length === 0 && (
                <p className="dim" style={{ fontSize: 13 }}>정기공연 팀이 없습니다. 아래에서 추가하세요.</p>
              )}
              {modalRows.map(({ t, i }, k) => (
                <div key={t.id} style={{ marginBottom: 10 }}>
                  <div className="flex items-center gap-8">
                    <input className="input grow" value={t.name} onChange={(e) => setDraftName(i, e.target.value)} maxLength={30} />
                    <button className="btn ghost btn-sm" onClick={() => swapTeam(i, modalRows[k - 1].i)} disabled={k === 0} aria-label="위로">▲</button>
                    <button className="btn ghost btn-sm" onClick={() => swapTeam(i, modalRows[k + 1].i)} disabled={k === modalRows.length - 1} aria-label="아래로">▼</button>
                  </div>
                  <div className="flex items-center gap-8" style={{ marginTop: 4 }}>
                    <button className="btn danger btn-sm" disabled={teamBusy} onClick={() => removeTeamInModal(t)} aria-label={`${t.name} 삭제`}>삭제</button>
                  </div>
                </div>
              ))}
            </div>

            <div className="field" style={{ marginTop: 4 }}>
              <label>새 팀 추가</label>
              <div className="flex items-center gap-8">
                <input
                  className="input grow"
                  value={newTeam}
                  onChange={(e) => setNewTeam(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && addTeamInModal()}
                  placeholder="예: 어쿠스틱 팀"
                  maxLength={30}
                />
                <button className="btn ghost btn-sm" disabled={teamBusy} onClick={addTeamInModal}>＋ 추가</button>
              </div>
            </div>

            {teamError && <p className="form-error">{teamError}</p>}

            <div className="btn-row" style={{ marginTop: 12 }}>
              <button className="btn amber" style={{ flex: 1 }} disabled={teamBusy} onClick={saveTeams}>
                {teamBusy ? "저장 중…" : "저장"}
              </button>
              <button className="btn ghost" disabled={teamBusy} onClick={() => setShowTeamModal(false)}>취소</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
