"use client";

import { useMemo, useState } from "react";
import type { Board, Post } from "@/lib/types";
import { getSupabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth";
import { can } from "@/lib/roles";

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
  const { user } = useAuth();
  const canManageBoards = can.manageBoards(user?.role);
  const canWriteNotice = can.writeNotice(user?.role);
  // 운영진(회장·총무·STAFF, admin) — 게시글 삭제 권한
  const isOperator = can.manageBoards(user?.role);

  const [boards, setBoards] = useState<Board[]>(initialBoards);
  const [posts, setPosts] = useState<Post[]>(initialPosts);
  const [activeBoard, setActiveBoard] = useState<string>(initialBoards[0]?.id ?? "");

  // 글쓰기 폼
  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [pinned, setPinned] = useState(false);

  // 수정 폼 (수정 중인 글 id)
  const [editingId, setEditingId] = useState<string>("");
  const [editTitle, setEditTitle] = useState("");
  const [editBody, setEditBody] = useState("");
  const [editPinned, setEditPinned] = useState(false);

  const startEdit = (p: Post) => {
    setEditingId(p.id);
    setEditTitle(p.title);
    setEditBody(p.body);
    setEditPinned(p.pinned);
  };
  const cancelEdit = () => setEditingId("");

  const saveEdit = async (p: Post) => {
    if (!editTitle.trim() || !editBody.trim()) return;
    const patch = { title: editTitle.trim(), body: editBody.trim(), pinned: editPinned };
    const sb = getSupabase();
    if (sb) await sb.from("posts").update(patch).eq("id", p.id);
    setPosts((prev) => prev.map((x) => (x.id === p.id ? { ...x, ...patch } : x)));
    setEditingId("");
  };

  const deletePost = async (p: Post) => {
    if (!isOperator) return;
    if (!window.confirm("이 게시글을 삭제할까요? 되돌릴 수 없습니다.")) return;
    const sb = getSupabase();
    if (sb) await sb.from("posts").delete().eq("id", p.id);
    setPosts((prev) => prev.filter((x) => x.id !== p.id));
    if (editingId === p.id) setEditingId("");
  };

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
  // 공지사항 게시판은 STAFF 이상만, 그 외 게시판은 로그인한 회원이면 작성 가능
  const canWriteHere = current?.is_notice ? canWriteNotice : !!user;

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
      author: user?.name ?? "나",
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
        {canManageBoards && (
          <button className="tab" onClick={addBoard} title="운영진(STAFF 이상) 전용 · 게시판 추가">
            ＋ 게시판
          </button>
        )}
      </div>

      {/* 글쓰기 — 권한 있는 경우에만 */}
      {canWriteHere ? (
        <button
          className="btn amber"
          style={{ width: "100%" }}
          onClick={() => setShowForm((v) => !v)}
        >
          {showForm ? "닫기" : current?.is_notice ? "＋ 공지 작성" : "＋ 글쓰기"}
        </button>
      ) : (
        current?.is_notice && (
          <p className="dim" style={{ fontSize: 12, textAlign: "center", margin: "4px 0" }}>
            🔒 공지사항 작성은 운영진(STAFF 이상)만 가능합니다.
          </p>
        )
      )}

      {showForm && canWriteHere && (
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
        boardPosts.map((p) => {
          // 수정: 작성자 본인 또는 운영진 / 삭제: 운영진만
          const canEditThis = isOperator || (!!user && user.name === p.author);
          const isEditing = editingId === p.id;

          if (isEditing) {
            return (
              <div className="card" key={p.id}>
                <div className="form-grid">
                  <div className="field">
                    <label>제목</label>
                    <input className="input" value={editTitle} onChange={(e) => setEditTitle(e.target.value)} placeholder="글 제목" />
                  </div>
                  <div className="field">
                    <label>내용</label>
                    <textarea
                      className="input"
                      value={editBody}
                      onChange={(e) => setEditBody(e.target.value)}
                      rows={4}
                      style={{ resize: "vertical" }}
                    />
                  </div>
                  <label className="flex items-center gap-8" style={{ fontSize: 13 }}>
                    <input type="checkbox" checked={editPinned} onChange={(e) => setEditPinned(e.target.checked)} />
                    상단 고정{current?.is_notice ? " (공지사항 고정글은 홈에 노출됩니다)" : ""}
                  </label>
                  <div className="btn-row">
                    <button className="btn amber btn-sm" onClick={() => saveEdit(p)}>저장</button>
                    <button className="btn ghost btn-sm" onClick={cancelEdit}>취소</button>
                  </div>
                </div>
              </div>
            );
          }

          return (
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
              {(canEditThis || isOperator) && (
                <div className="btn-row" style={{ marginTop: 8 }}>
                  {canEditThis && (
                    <button className="btn ghost btn-sm" onClick={() => startEdit(p)}>수정</button>
                  )}
                  {isOperator && (
                    <button className="btn danger btn-sm" onClick={() => deletePost(p)}>삭제</button>
                  )}
                </div>
              )}
            </div>
          );
        })
      )}

      <p className="dim" style={{ fontSize: 12, textAlign: "center", marginTop: 8 }}>
        수정은 작성자 본인 또는 운영진, 삭제는 운영진(STAFF 이상)만 가능합니다. 공지사항 고정글은 홈에 표시됩니다.
      </p>
    </>
  );
}
