"use client";

import { useMemo, useState } from "react";
import type { Board, Post } from "@/lib/types";
import { getSupabase } from "@/lib/supabase";

function formatDate(iso: string) {
  const d = new Date(iso);
  return `${d.getMonth() + 1}월 ${d.getDate()}일`;
}

export default function BoardView({
  boards: initialBoards,
  posts: initialPosts,
}: {
  boards: Board[];
  posts: Post[];
}) {
  const [boards, setBoards] = useState<Board[]>(initialBoards);
  const [posts, setPosts] = useState<Post[]>(initialPosts);
  const [activeBoard, setActiveBoard] = useState<string>(initialBoards[0]?.id ?? "");

  // 글쓰기 폼
  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [pinned, setPinned] = useState(false);

  const boardPosts = useMemo(
    () =>
      posts
        .filter((p) => p.board_id === activeBoard)
        .sort((a, b) =>
          a.pinned === b.pinned
            ? b.created_at.localeCompare(a.created_at)
            : a.pinned
              ? -1
              : 1,
        ),
    [posts, activeBoard],
  );

  const current = boards.find((b) => b.id === activeBoard);

  // 운영진: 게시판 추가
  const addBoard = async () => {
    const name = window.prompt("새 게시판 제목을 입력하세요");
    if (!name || !name.trim()) return;
    const payload = { name: name.trim(), is_notice: false };
    const sb = getSupabase();
    if (sb) {
      const { data, error } = await sb.from("boards").insert(payload).select().single();
      if (!error && data) {
        const board = data as Board;
        setBoards((prev) => [...prev, board]);
        setActiveBoard(board.id);
      }
    } else {
      const board: Board = {
        id: `board-${boards.length}-${name.trim()}`,
        name: name.trim(),
        is_notice: false,
        created_at: new Date().toISOString(),
      };
      setBoards((prev) => [...prev, board]);
      setActiveBoard(board.id);
    }
  };

  const addPost = async () => {
    if (!title.trim() || !body.trim()) return;
    const payload = {
      board_id: activeBoard,
      title: title.trim(),
      body: body.trim(),
      author: "나",
      pinned,
    };
    const sb = getSupabase();
    if (sb) {
      const { data, error } = await sb.from("posts").insert(payload).select().single();
      if (!error && data) setPosts((prev) => [...prev, data as Post]);
    } else {
      setPosts((prev) => [
        ...prev,
        { id: `post-${prev.length}`, created_at: new Date().toISOString(), ...payload },
      ]);
    }
    setTitle("");
    setBody("");
    setPinned(false);
    setShowForm(false);
  };

  return (
    <>
      {/* 게시판 탭 + 추가 버튼 */}
      <div className="tab-row">
        {boards.map((b) => (
          <button
            key={b.id}
            className={`tab${activeBoard === b.id ? " active" : ""}`}
            onClick={() => setActiveBoard(b.id)}
          >
            {b.is_notice ? "📢 " : ""}
            {b.name}
          </button>
        ))}
        <button className="tab" onClick={addBoard} title="운영진 전용 · 게시판 추가">
          ＋ 게시판
        </button>
      </div>

      {/* 글쓰기 */}
      <button
        className="btn amber"
        style={{ width: "100%" }}
        onClick={() => setShowForm((v) => !v)}
      >
        {showForm ? "닫기" : "＋ 글쓰기"}
      </button>

      {showForm && (
        <div className="card mt-12">
          <div className="form-grid">
            <div className="field">
              <label>제목</label>
              <input className="input" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="글 제목" />
            </div>
            <div className="field">
              <label>내용</label>
              <textarea
                className="input"
                value={body}
                onChange={(e) => setBody(e.target.value)}
                placeholder="내용을 입력하세요"
                rows={4}
                style={{ resize: "vertical" }}
              />
            </div>
            <label className="flex items-center gap-8" style={{ fontSize: 13 }}>
              <input type="checkbox" checked={pinned} onChange={(e) => setPinned(e.target.checked)} />
              상단 고정{current?.is_notice ? " (공지사항 고정글은 홈에 노출됩니다)" : ""}
            </label>
            <button className="btn amber" onClick={addPost}>
              등록하기
            </button>
          </div>
        </div>
      )}

      <div className="section-title">
        {current?.is_notice ? "📢 " : "📝 "}
        {current?.name} ({boardPosts.length})
      </div>

      {boardPosts.length === 0 ? (
        <div className="card">
          <p className="dim" style={{ margin: 0, fontSize: 13 }}>
            아직 게시글이 없습니다. 위에서 글을 작성해 보세요.
          </p>
        </div>
      ) : (
        boardPosts.map((p) => (
          <div className="card" key={p.id}>
            <div className="title-row">
              <div className="item-name">{p.title}</div>
              {p.pinned && <span className="badge amber">📌 고정</span>}
            </div>
            <p className="item-sub" style={{ marginTop: 8, lineHeight: 1.5, whiteSpace: "pre-wrap" }}>
              {p.body}
            </p>
            <div className="meta-line">
              {p.author} · {formatDate(p.created_at)}
            </div>
          </div>
        ))
      )}

      <p className="dim" style={{ fontSize: 12, textAlign: "center", marginTop: 8 }}>
        ＋게시판 버튼으로 운영진이 새 게시판을 추가할 수 있어요. 공지사항 고정글은 홈에 표시됩니다.
      </p>
    </>
  );
}
