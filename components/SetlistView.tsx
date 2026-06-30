"use client";

import { useMemo, useState } from "react";
import type { Song, Team } from "@/lib/types";
import { getSupabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth";
import { can } from "@/lib/roles";
import { addTeam, renameTeam, reorderTeams } from "@/lib/team-actions";

type MemberLite = { id: string; name: string; part: string; team_id: string | null };

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
  members,
}: {
  teams: Team[];
  initial: Song[];
  myTeamId: string | null;
  members: MemberLite[];
}) {
  const { user } = useAuth();
  const canManageTeams = can.manageTeams(user?.role);

  const [teamList, setTeamList] = useState<Team[]>(teams);
  const [songs, setSongs] = useState<Song[]>(initial);
  const [activeTeam, setActiveTeam] = useState<string>(teams[0]?.id ?? "");

  // 현재 보고 있는 팀을 관리할 수 있는가 (본인팀 또는 운영진)
  const canManageActive = canManageTeams || (myTeamId != null && myTeamId === activeTeam);

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

  // 팀 수정 팝업 (운영진)
  const [showTeamModal, setShowTeamModal] = useState(false);
  const [draft, setDraft] = useState<Team[]>([]);
  const [newTeam, setNewTeam] = useState("");
  const [teamBusy, setTeamBusy] = useState(false);
  const [teamError, setTeamError] = useState("");

  // 팀원 보기 팝업 (전체)
  const [showMembers, setShowMembers] = useState(false);

  const openTeamModal = () => {
    setDraft(teamList.map((t) => ({ ...t })));
    setNewTeam("");
    setTeamError("");
    setShowTeamModal(true);
  };

  const moveTeam = (i: number, dir: -1 | 1) => {
    setDraft((prev) => {
      const j = i + dir;
      if (j < 0 || j >= prev.length) return prev;
      const next = [...prev];
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });
  };
  const setDraftName = (i: number, name: string) =>
    setDraft((prev) => prev.map((t, idx) => (idx === i ? { ...t, name } : t)));

  const addTeamInModal = async () => {
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
    setDraft((prev) => [...prev, res.team]);
    setTeamList((prev) => [...prev, res.team]);
    setNewTeam("");
  };

  const saveTeams = async () => {
    setTeamError("");
    // 빈 이름 검사
    if (draft.some((t) => !t.name.trim())) {
      setTeamError("팀 이름은 비울 수 없습니다.");
      return;
    }
    setTeamBusy(true);
    // 이름 변경분 저장
    for (const t of draft) {
      const orig = teamList.find((x) => x.id === t.id);
      if (orig && orig.name !== t.name.trim()) await renameTeam(t.id, t.name.trim());
    }
    // 순서 저장
    await reorderTeams(draft.map((t) => t.id));
    setTeamBusy(false);
    setTeamList(draft.map((t, i) => ({ ...t, name: t.name.trim(), sort_order: i })));
    setShowTeamModal(false);
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

  const activeTeamName = teamList.find((t) => t.id === activeTeam)?.name ?? "";
  const activeMembers = members
    .filter((m) => m.team_id === activeTeam)
    .sort((a, b) => a.name.localeCompare(b.name, "ko"));

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
      {/* 팀별 탭 */}
      <div className="tab-row">
        {teamList.map((t) => (
          <button
            key={t.id}
            className={`tab${activeTeam === t.id ? " active" : ""}`}
            onClick={() => setActiveTeam(t.id)}
          >
            {t.name}
          </button>
        ))}
      </div>

      {/* 팀 도구 버튼 */}
      <div className="flex items-center gap-8" style={{ marginTop: 8 }}>
        <button className="btn ghost btn-sm" onClick={() => setShowMembers(true)}>
          👥 팀원 보기
        </button>
        {canManageTeams && (
          <button className="btn ghost btn-sm" onClick={openTeamModal}>
            ⚙ 팀 수정
          </button>
        )}
      </div>

      {/* 곡 올리기 — 본인팀/운영진만 */}
      {canManageActive && (
        <>
          <button className="btn amber" style={{ width: "100%", marginTop: 8 }} onClick={() => setShowForm((v) => !v)}>
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
        🎼 {activeTeamName} 셋리스트 ({teamSongs.length})
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

      {/* 팀원 보기 팝업 */}
      {showMembers && (
        <div className="modal-overlay" onClick={() => setShowMembers(false)}>
          <div className="card" style={{ margin: 0, width: "100%", maxWidth: 420, maxHeight: "80vh", overflowY: "auto" }} onClick={(e) => e.stopPropagation()}>
            <div className="title-row">
              <div className="section-title" style={{ margin: 0 }}>👥 {activeTeamName} 팀원 ({activeMembers.length})</div>
              <button className="btn ghost btn-sm" onClick={() => setShowMembers(false)}>닫기</button>
            </div>
            {activeMembers.length === 0 ? (
              <p className="dim" style={{ fontSize: 13, marginBottom: 0 }}>이 팀에 배정된 회원이 없습니다.</p>
            ) : (
              <div style={{ marginTop: 8 }}>
                {activeMembers.map((m) => (
                  <div key={m.id} className="res-item">
                    <span className="m-name">{m.name}</span>
                    <span className="dim" style={{ fontSize: 13 }}>{m.part}</span>
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
              <div className="section-title" style={{ margin: 0 }}>⚙ 팀 수정</div>
              <button className="btn ghost btn-sm" onClick={() => setShowTeamModal(false)}>닫기</button>
            </div>
            <p className="dim" style={{ fontSize: 12, marginTop: 4 }}>이름을 수정하고 ▲▼로 순서를 바꾼 뒤 저장하세요.</p>

            <div style={{ marginTop: 8 }}>
              {draft.map((t, i) => (
                <div key={t.id} className="flex items-center gap-8" style={{ marginBottom: 8 }}>
                  <input className="input grow" value={t.name} onChange={(e) => setDraftName(i, e.target.value)} maxLength={30} />
                  <button className="btn ghost btn-sm" onClick={() => moveTeam(i, -1)} disabled={i === 0} aria-label="위로">▲</button>
                  <button className="btn ghost btn-sm" onClick={() => moveTeam(i, 1)} disabled={i === draft.length - 1} aria-label="아래로">▼</button>
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
