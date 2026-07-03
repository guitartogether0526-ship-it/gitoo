"use client";

import { useState } from "react";
import Link from "next/link";
import type { Member, SessionUser } from "@/lib/types";
import { useAuth } from "@/lib/auth";
import { ROLE_LABEL } from "@/lib/roles";
import { updateMyProfile, changeMyPassword } from "@/lib/auth-actions";
import { PARTS } from "@/lib/parts";

export default function MyPageForm({
  session,
  member,
}: {
  session: SessionUser | null;
  member: Member | null;
}) {
  const { login: setSession } = useAuth();

  const [name, setName] = useState(member?.name ?? "");
  const [phone, setPhone] = useState(member?.phone ?? "");
  const [email, setEmail] = useState(member?.email ?? "");
  const [part, setPart] = useState(member?.part ?? "기타");
  const [part2, setPart2] = useState(member?.part2 ?? ""); // 악기2 (선택, "" = 없음)
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);

  // 비밀번호 변경
  const [curPw, setCurPw] = useState("");
  const [newPw, setNewPw] = useState("");
  const [newPw2, setNewPw2] = useState("");
  const [pwError, setPwError] = useState("");
  const [pwSaved, setPwSaved] = useState(false);
  const [pwBusy, setPwBusy] = useState(false);

  const submitPw = async () => {
    setPwError("");
    setPwSaved(false);
    if (newPw !== newPw2) {
      setPwError("새 비밀번호가 일치하지 않습니다.");
      return;
    }
    if (newPw.length < 4) {
      setPwError("새 비밀번호는 4자 이상이어야 합니다.");
      return;
    }
    setPwBusy(true);
    const res = await changeMyPassword({ currentPassword: curPw, newPassword: newPw });
    setPwBusy(false);
    if ("error" in res) {
      setPwError(res.error);
      return;
    }
    setPwSaved(true);
    setCurPw("");
    setNewPw("");
    setNewPw2("");
  };

  if (!session) {
    return (
      <div className="card">
        <p className="dim" style={{ margin: 0, fontSize: 13 }}>로그인이 필요합니다.</p>
      </div>
    );
  }

  // 관리자 계정 또는 회원 레코드 없음 — 읽기 전용 안내
  if (session.id === "admin" || !member) {
    return (
      <>
        <div className="card">
          <div className="title-row">
            <span className="m-name">{session.name}</span>
            <span className="badge amber">{ROLE_LABEL[session.role]}</span>
          </div>
          <p className="dim" style={{ marginTop: 10, fontSize: 13 }}>
            {session.id === "admin"
              ? "관리자 계정은 기본 정보를 수정할 수 없습니다."
              : "회원 정보를 불러올 수 없습니다. 운영진에게 문의하세요."}
          </p>
        </div>
        <Link href="/" className="btn ghost" style={{ width: "100%", marginTop: 12, textAlign: "center" }}>
          ← 홈으로
        </Link>
      </>
    );
  }

  const submit = async () => {
    setError("");
    setSaved(false);
    if (part2 && part2 === part) {
      setError("악기 2는 악기 1과 다른 악기를 선택하세요.");
      return;
    }
    setBusy(true);
    const res = await updateMyProfile({ name, phone, email, part, part2 });
    setBusy(false);
    if ("error" in res) {
      setError(res.error);
      return;
    }
    setSaved(true);
    // 세션 쿠키 갱신(헤더 이름/이니셜 즉시 반영) + 서버 컴포넌트 재렌더
    setSession(res.user);
  };

  return (
    <>
      <div className="card">
        <div className="form-grid">
          <div className="field">
            <label>아이디</label>
            <input className="input" value={member.username} disabled readOnly />
          </div>
          <div className="field">
            <label>이름</label>
            <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="실명" />
          </div>
          <div className="field">
            <label>휴대폰번호</label>
            <input className="input" type="tel" inputMode="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="예: 010-1234-5678" autoComplete="tel" />
          </div>
          <div className="field">
            <label>이메일</label>
            <input className="input" type="email" inputMode="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="아이디·비밀번호 찾기에 사용됩니다" autoCapitalize="none" autoComplete="email" />
          </div>
          <div className="field">
            <label>악기 1 (주 파트)</label>
            <select
              className="select"
              value={part}
              onChange={(e) => {
                setPart(e.target.value);
                if (part2 === e.target.value) setPart2(""); // 악기2와 겹치면 악기2 해제
              }}
            >
              {PARTS.map((p) => (
                <option key={p}>{p}</option>
              ))}
              {!PARTS.includes(part) && <option>{part}</option>}
            </select>
          </div>
          <div className="field">
            <label>악기 2 (선택)</label>
            <select className="select" value={part2} onChange={(e) => setPart2(e.target.value)}>
              <option value="">없음</option>
              {PARTS.map((p) => (
                <option key={p} value={p} disabled={p === part}>
                  {p}
                </option>
              ))}
              {!!part2 && !PARTS.includes(part2) && <option>{part2}</option>}
            </select>
          </div>
          {error && <p className="form-error">{error}</p>}
          {saved && <p className="dim" style={{ color: "var(--ok, #5ac88a)", fontSize: 13, margin: 0 }}>저장되었습니다.</p>}
          <button className="btn amber" disabled={busy} onClick={submit}>
            {busy ? "저장 중…" : "기본 정보 저장"}
          </button>
        </div>
      </div>
      <p className="dim" style={{ fontSize: 12, textAlign: "center", marginTop: 10 }}>
        권한·팀 변경은 운영진에게 문의하세요. (아이디는 변경할 수 없습니다)
      </p>

      <div className="section-title">비밀번호 변경</div>
      <div className="card">
        <div className="form-grid">
          <div className="field">
            <label>현재 비밀번호</label>
            <input className="input" type="password" value={curPw} onChange={(e) => setCurPw(e.target.value)} placeholder="현재 비밀번호" autoComplete="current-password" />
          </div>
          <div className="field">
            <label>새 비밀번호</label>
            <input className="input" type="password" value={newPw} onChange={(e) => setNewPw(e.target.value)} placeholder="4자 이상" autoComplete="new-password" />
          </div>
          <div className="field">
            <label>새 비밀번호 확인</label>
            <input className="input" type="password" value={newPw2} onChange={(e) => setNewPw2(e.target.value)} placeholder="다시 입력" autoComplete="new-password" />
          </div>
          {pwError && <p className="form-error">{pwError}</p>}
          {pwSaved && <p className="dim" style={{ color: "var(--ok, #5ac88a)", fontSize: 13, margin: 0 }}>비밀번호가 변경되었습니다.</p>}
          <button className="btn amber" disabled={pwBusy} onClick={submitPw}>
            {pwBusy ? "변경 중…" : "비밀번호 변경"}
          </button>
        </div>
      </div>
    </>
  );
}
