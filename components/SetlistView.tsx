"use client";

import { useMemo, useState } from "react";
import type { Song, Team } from "@/lib/types";
import { getSupabase } from "@/lib/supabase";

const HeartIcon = ({ filled }: { filled: boolean }) => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill={filled ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 20s-7-4.6-9.3-9.1C1.2 8 2.5 5 5.5 5c1.9 0 3 1 2.5 1S10 5 12 7c2-2 4-2 4-2s.6 0 2.5 0c3 0 4.3 3 2.8 5.9C19 15.4 12 20 12 20Z" />
  </svg>
);

export default function SetlistView({
  teams,
  initial,
}: {
  teams: Team[];
  initial: Song[];
}) {
  const [songs, setSongs] = useState<Song[]>(initial);
  const [activeTeam, setActiveTeam] = useState<string>(teams[0]?.id ?? "");

  // 곡 올리기 폼
  const [title, setTitle] = useState("");
  const [artist, setArtist] = useState("");
  const [parts, setParts] = useState("기타, 베이스, 드럼, 보컬");
  const [showForm, setShowForm] = useState(false);

  const teamSongs = useMemo(
    () =>
      songs
        .filter((s) => s.team_id === activeTeam)
        .sort((a, b) => a.title.localeCompare(b.title, "ko")),
    [songs, activeTeam],
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

  // 곡 선정 ↔ 후보 전환
  const toggleStatus = (id: string) => {
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
    if (!title.trim() || !artist.trim()) return;
    const partList = parts
      .split(",")
      .map((p) => p.trim())
      .filter(Boolean);
    const payload = {
      team_id: activeTeam,
      title: title.trim(),
      artist: artist.trim(),
      parts: partList,
      sheets: [],
      likes: 0,
      voted: false,
      status: "candidate" as const,
    };
    const sb = getSupabase();
    if (sb) {
      const { data, error } = await sb.from("songs").insert(payload).select().single();
      if (!error && data) setSongs((prev) => [...prev, data as Song]);
    } else {
      setSongs((prev) => [...prev, { id: `song-${activeTeam}-${prev.length}`, ...payload }]);
    }
    setTitle("");
    setArtist("");
    setShowForm(false);
  };

  return (
    <>
      {/* 팀별 탭 */}
      <div className="tab-row">
        {teams.map((t) => (
          <button
            key={t.id}
            className={`tab${activeTeam === t.id ? " active" : ""}`}
            onClick={() => setActiveTeam(t.id)}
          >
            {t.name}
          </button>
        ))}
      </div>

      {/* 곡 올리기 */}
      <button
        className="btn amber"
        style={{ width: "100%" }}
        onClick={() => setShowForm((v) => !v)}
      >
        {showForm ? "닫기" : "＋ 곡 선정해서 올리기"}
      </button>

      {showForm && (
        <div className="card mt-12">
          <div className="form-grid">
            <div className="field">
              <label>곡명</label>
              <input className="input" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="곡 제목" />
            </div>
            <div className="field">
              <label>아티스트</label>
              <input className="input" value={artist} onChange={(e) => setArtist(e.target.value)} placeholder="아티스트명" />
            </div>
            <div className="field">
              <label>담당 파트 (쉼표로 구분)</label>
              <input className="input" value={parts} onChange={(e) => setParts(e.target.value)} placeholder="기타, 베이스, 드럼, 보컬" />
            </div>
            <button className="btn amber" onClick={addSong}>
              셋리스트에 올리기
            </button>
          </div>
        </div>
      )}

      <div className="section-title">
        🎼 {teams.find((t) => t.id === activeTeam)?.name} 셋리스트 ({teamSongs.length})
      </div>

      {teamSongs.length === 0 ? (
        <div className="card">
          <p className="dim" style={{ margin: 0, fontSize: 13 }}>
            아직 올라온 곡이 없습니다. 위에서 곡을 선정해 올려보세요.
          </p>
        </div>
      ) : (
        teamSongs.map((s) => (
          <div className="card" key={s.id}>
            <div className="title-row">
              <div className="grow">
                <div className="flex items-center gap-8" style={{ flexWrap: "wrap" }}>
                  <span className="item-name">{s.title}</span>
                  <button
                    className={`badge ${s.status === "confirmed" ? "amber" : ""}`}
                    onClick={() => toggleStatus(s.id)}
                    style={{ cursor: "pointer" }}
                    title="선정/후보 전환"
                  >
                    {s.status === "confirmed" ? "★ 선정곡" : "후보"}
                  </button>
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

            <div className="meta-line">담당 파트: {s.parts.join(" · ") || "미정"}</div>

            {s.sheets.length > 0 && (
              <div className="sheet-links">
                {s.sheets.map((sh, i) => (
                  <a key={i} className="sheet-link" href={sh.file_url} download>
                    ⬇ {sh.part} · {sh.file_label}
                  </a>
                ))}
              </div>
            )}
          </div>
        ))
      )}

      <p className="dim" style={{ fontSize: 12, textAlign: "center", marginTop: 8 }}>
        팀 탭에서 곡을 선정해 올리고, ♥로 투표 · 뱃지를 눌러 선정/후보를 전환하세요.
      </p>
    </>
  );
}
