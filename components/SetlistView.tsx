"use client";

import { useMemo, useState } from "react";
import type { Song, Team } from "@/lib/types";
import { getSupabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth";
import { can } from "@/lib/roles";
import { addTeam, reorderTeams } from "@/lib/team-actions";

const HeartIcon = ({ filled }: { filled: boolean }) => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill={filled ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 20s-7-4.6-9.3-9.1C1.2 8 2.5 5 5.5 5c1.9 0 3 1 2.5 1S10 5 12 7c2-2 4-2 4-2s.6 0 2.5 0c3 0 4.3 3 2.8 5.9C19 15.4 12 20 12 20Z" />
  </svg>
);

// 스킴 없는 링크도 새창에서 열리도록 보정
const normalizeUrl = (u: string) => {
  const t = u.trim();
  if (!t) return "";
  return /^https?:\/\//i.test(t) ? t : `https://${t}`;
};

export default function SetlistView({
  teams,
  initial,
  myTeamId,
}: {
  teams: Team[];
  initial: Song[];
  myTeamId: string | null;
}) {
  const { user } = useAuth();
  const canManageTeams = can.manageTeams(user?.role);
  // 운영진은 모든 팀을 본인팀처럼 취급
  const isOperator = canManageTeams;

  const [teamList, setTeamList] = useState<Team[]>(teams);
  const [songs, setSongs] = useState<Song[]>(initial);
  const [activeTeam, setActiveTeam] = useState<string>(teams[0]?.id ?? "");

  // 현재 보고 있는 팀을 관리할 수 있는가 (본인팀 또는 운영진)
  const canManageActive = isOperator || (myTeamId != null && myTeamId === activeTeam);

  // 팀 추가 폼
  const [newTeam, setNewTeam] = useState("");
  const [teamBusy, setTeamBusy] = useState(false);
  const [teamError, setTeamError] = useState("");

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

  const onAddTeam = async () => {
    setTeamError("");
    const name = newTeam.trim();
    if (!name) return;
    setTeamBusy(true);
    const res = await addTeam(name);
    setTeamBusy(false);
    if ("error" in res) {
      setTeamError(res.error);
      return;
    }
    setTeamList((prev) => [...prev, res.team]);
    setActiveTeam(res.team.id);
    setNewTeam("");
  };

  // 팀 순서 드래그 (운영진 전용)
  const [dragId, setDragId] = useState<string>("");

  const onDropTeam = async (targetId: string) => {
    if (!dragId || dragId === targetId) {
      setDragId("");
      return;
    }
    const next = [...teamList];
    const from = next.findIndex((t) => t.id === dragId);
    const to = next.findIndex((t) => t.id === targetId);
    if (from < 0 || to < 0) return;
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    setTeamList(next);
    setDragId("");
    const res = await reorderTeams(next.map((t) => t.id));
    if ("error" in res) setTeamError(res.error);
  };

  // 표시할 곡: 본인팀/운영진은 전체, 다른 팀은 선정곡만
  const teamSongs = useMemo(
    () =>
      songs
        .filter((s) => s.team_id === activeTeam)
        .filter((s) => canManageActive || s.status === "confirmed")
        .sort((a, b) => a.title.localeCompare(b.title, "ko")),
    [songs, activeTeam, canManageActive],
  );

  const toggleLike = (id: string) => {
    let nextVoted = false;
    let nextLikes = 0;
    setSongs((prev) =>
      prev.map((s) => {
        if (s.id !== id) return s;
        nextVoted = !s.voted;
        nextLikes = s.likes + (s.voted ? -1 : 1);
        return { ...s, voted: nextVoted, likes: nextLikes };
      }),
    );
    const sb = getSupabase();
    if (sb) void sb.from("songs").update({ voted: nextVoted, likes: nextLikes }).eq("id", id);
  };

  // 곡 선정 ↔ 후보 전환 (본인팀/운영진)
  const toggleStatus = (id: string) => {
    if (!canManageActive) return;
    let next: "candidate" | "confirmed" = "candidate";
    setSongs((prev) =>
      prev.map((s) => {
        if (s.id !== id) return s;
        next = s.status === "confirmed" ? "candidate" : "confirmed";
        return { ...s, status: next };
      }),
    );
    const sb = getSupabase();
    if (sb) void sb.from("songs").update({ status: next }).eq("id", id);
  };

  const addSong = async () => {
    if (!canManageActive || !title.trim() || !artist.trim()) return;
    const payload = {
      team_id: activeTeam,
      title: title.trim(),
      artist: artist.trim(),
      youtube_url: normalizeUrl(youtube) || null,
      parts: [],
      sheets: [],
      likes: 0,
      voted: false,
      status: "candidate" as const,
    };
    const sb = getSupabase();
    if (sb) {
      let res = await sb.from("songs").insert(payload).select().single();
      if (res.error) {
        // youtube_url 컬럼이 아직 없을 수 있어 제외하고 재시도
        const { youtube_url: _yt, ...rest } = payload;
        res = await sb.from("songs").insert(rest).select().single();
      }
      if (!res.error && res.data) setSongs((prev) => [...prev, res.data as Song]);
    } else {
      setSongs((prev) => [...prev, { id: `song-${activeTeam}-${prev.length}`, ...payload }]);
    }
    setTitle("");
    setArtist("");
    setYoutube("");
    setShowForm(false);
  };

  const startEdit = (s: Song) => {
    setEditId(s.id);
    setETitle(s.title);
    setEArtist(s.artist);
    setEYoutube(s.youtube_url ?? "");
  };
  const cancelEdit = () => setEditId("");

  const saveEdit = async (id: string) => {
    if (!eTitle.trim() || !eArtist.trim()) return;
    const patch = {
      title: eTitle.trim(),
      artist: eArtist.trim(),
      youtube_url: normalizeUrl(eYoutube) || null,
    };
    setSongs((prev) => prev.map((s) => (s.id === id ? { ...s, ...patch } : s)));
    setEditId("");
    const sb = getSupabase();
    if (sb) {
      const { error } = await sb.from("songs").update(patch).eq("id", id);
      if (error) await sb.from("songs").update({ title: patch.title, artist: patch.artist }).eq("id", id);
    }
  };

  const deleteSong = async (id: string) => {
    if (!canManageActive) return;
    if (!window.confirm("이 곡을 삭제할까요? 되돌릴 수 없습니다.")) return;
    setSongs((prev) => prev.filter((s) => s.id !== id));
    if (editId === id) setEditId("");
    const sb = getSupabase();
    if (sb) await sb.from("songs").delete().eq("id", id);
  };

  return (
    <>
      {/* 팀별 탭 (운영진은 드래그로 순서 변경) */}
      <div className="tab-row">
        {teamList.map((t) => (
          <button
            key={t.id}
            className={`tab${activeTeam === t.id ? " active" : ""}${dragId === t.id ? " dragging" : ""}`}
            onClick={() => setActiveTeam(t.id)}
            draggable={canManageTeams}
            onDragStart={canManageTeams ? () => setDragId(t.id) : undefined}
            onDragOver={canManageTeams ? (e) => e.preventDefault() : undefined}
            onDrop={canManageTeams ? () => onDropTeam(t.id) : undefined}
            onDragEnd={canManageTeams ? () => setDragId("") : undefined}
            style={canManageTeams ? { cursor: "grab", opacity: dragId === t.id ? 0.4 : 1 } : undefined}
            title={canManageTeams ? "드래그해서 순서 변경" : undefined}
          >
            {canManageTeams && <span style={{ opacity: 0.5, marginRight: 4 }}>⠿</span>}
            {t.name}
          </button>
        ))}
      </div>
      {canManageTeams && (
        <p className="dim" style={{ fontSize: 11, margin: "2px 0 0" }}>
          ⠿ 탭을 드래그하면 팀 순서를 바꿀 수 있어요 (운영진 전용).
        </p>
      )}

      {/* 팀 추가 — 운영진 전용 */}
      {canManageTeams && (
        <div className="card mt-12">
          <div className="field">
            <label>새 팀 추가</label>
            <div className="flex items-center gap-8">
              <input
                className="input grow"
                value={newTeam}
                onChange={(e) => setNewTeam(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && onAddTeam()}
                placeholder="예: 4팀 / 어쿠스틱 팀"
                maxLength={30}
              />
              <button className="btn amber" disabled={teamBusy} onClick={onAddTeam}>
                {teamBusy ? "추가 중…" : "＋ 팀 추가"}
              </button>
            </div>
          </div>
          {teamError && <p className="form-error" style={{ marginBottom: 0 }}>{teamError}</p>}
        </div>
      )}

      {/* 곡 올리기 — 본인팀/운영진만 */}
      {canManageActive && (
        <>
          <button className="btn amber" style={{ width: "100%" }} onClick={() => setShowForm((v) => !v)}>
            {showForm ? "닫기" : "＋ 곡 올리기"}
          </button>

          {showForm && (
            <div className="card mt-12">
              <div className="form-grid">
                <div className="field">
                  <label>곡 제목</label>
                  <input className="input" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="곡 제목" />
                </div>
                <div className="field">
                  <label>아티스트명</label>
                  <input className="input" value={artist} onChange={(e) => setArtist(e.target.value)} placeholder="아티스트명" />
                </div>
                <div className="field">
                  <label>유튜브 링크</label>
                  <input
                    className="input"
                    type="url"
                    inputMode="url"
                    value={youtube}
                    onChange={(e) => setYoutube(e.target.value)}
                    placeholder="https://youtu.be/..."
                    autoCapitalize="none"
                  />
                </div>
                <button className="btn amber" onClick={addSong}>
                  셋리스트에 올리기
                </button>
              </div>
            </div>
          )}
        </>
      )}

      <div className="section-title">
        🎼 {teamList.find((t) => t.id === activeTeam)?.name} 셋리스트 ({teamSongs.length})
        {!canManageActive && <span className="dim" style={{ fontSize: 12, fontWeight: 400 }}> · 선정곡만 표시</span>}
      </div>

      {teamSongs.length === 0 ? (
        <div className="card">
          <p className="dim" style={{ margin: 0, fontSize: 13 }}>
            {canManageActive ? "아직 올라온 곡이 없습니다. 위에서 곡을 올려보세요." : "아직 공개된 선정곡이 없습니다."}
          </p>
        </div>
      ) : (
        teamSongs.map((s) =>
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
                <div className="btn-row">
                  <button className="btn amber btn-sm" onClick={() => saveEdit(s.id)}>저장</button>
                  <button className="btn ghost btn-sm" onClick={cancelEdit}>취소</button>
                </div>
              </div>
            </div>
          ) : (
            <div className="card" key={s.id}>
              <div className="title-row">
                <div className="grow">
                  <div className="flex items-center gap-8" style={{ flexWrap: "wrap" }}>
                    <span className="item-name">{s.title}</span>
                    {canManageActive ? (
                      <button
                        className={`badge ${s.status === "confirmed" ? "amber" : ""}`}
                        onClick={() => toggleStatus(s.id)}
                        style={{ cursor: "pointer" }}
                        title="선정/후보 전환"
                      >
                        {s.status === "confirmed" ? "★ 선정곡" : "후보"}
                      </button>
                    ) : (
                      <span className="badge amber">★ 선정곡</span>
                    )}
                  </div>
                  <div className="item-sub">{s.artist}</div>
                </div>
                <button
                  className={`like-btn${s.voted ? " liked" : ""}`}
                  onClick={() => toggleLike(s.id)}
                  aria-pressed={s.voted}
                >
                  <HeartIcon filled={s.voted} />
                  {s.likes}
                </button>
              </div>

              {s.youtube_url && (
                <div className="sheet-links">
                  <a className="sheet-link" href={s.youtube_url} target="_blank" rel="noopener noreferrer">
                    ▶ 유튜브로 보기
                  </a>
                </div>
              )}

              {canManageActive && (
                <div className="btn-row" style={{ marginTop: 8 }}>
                  <button className="btn ghost btn-sm" onClick={() => startEdit(s)}>수정</button>
                  <button className="btn danger btn-sm" onClick={() => deleteSong(s.id)}>삭제</button>
                </div>
              )}
            </div>
          ),
        )
      )}

      <p className="dim" style={{ fontSize: 12, textAlign: "center", marginTop: 8 }}>
        본인 팀 곡은 올리기·수정·삭제·선정이 가능하고, 다른 팀은 선정곡만 볼 수 있어요. (운영진은 전체 관리)
      </p>
    </>
  );
}
