"use client";

import { useState } from "react";

/** 접히는 공지 카드 — 제목만 보이다가 누르면 본문이 펼쳐진다. (홈·게시판 공용 표시) */
export default function NoticeCard({
  title,
  body,
  meta,
  pinned = false,
  defaultOpen = false,
}: {
  title: string;
  body: string;
  meta?: string;
  pinned?: boolean;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className="card">
      <button
        type="button"
        className="notice-head"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        <span className="notice-head-main">
          <span className="item-name">{title}</span>
          {pinned && <span className="badge amber">고정</span>}
        </span>
        <svg
          className="notice-chevron"
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M9 6l6 6-6 6" />
        </svg>
      </button>
      {open && (
        <>
          <p
            className="item-sub"
            style={{ marginTop: 8, lineHeight: 1.5, whiteSpace: "pre-wrap" }}
          >
            {body}
          </p>
          {meta && <div className="meta-line">{meta}</div>}
        </>
      )}
    </div>
  );
}
