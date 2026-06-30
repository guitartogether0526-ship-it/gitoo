"use client";

import { useState } from "react";
import type { SessionUser } from "@/lib/types";
import { useAuth } from "@/lib/auth";
import { login, signup, findUsername, resetPassword } from "@/lib/auth-actions";
import Logo from "./Logo";

type View = "login" | "signup" | "findId" | "findPw";

export default function LoginScreen() {
  const { login: setSession } = useAuth();
  const [view, setView] = useState<View>("login");

  return (
    <div className="login-screen">
      <div className="login-card">
        <div className="login-head">
          <Logo />
          <h1>GUITAR TOGETHER</h1>
          <p className="dim">
            {view === "login" && "아이디와 비밀번호로 로그인하세요"}
            {view === "signup" && "회원가입 — 관리자 승인 후 이용 가능"}
            {view === "findId" && "아이디 찾기"}
            {view === "findPw" && "비밀번호 재설정"}
          </p>
        </div>

        {view === "login" && <LoginForm onLoggedIn={setSession} onNav={setView} />}
        {view === "signup" && <SignupForm onNav={setView} />}
        {view === "findId" && <FindIdForm onNav={setView} />}
        {view === "findPw" && <FindPwForm onNav={setView} />}
      </div>
    </div>
  );
}

/* ---------------- 로그인 ---------------- */
function LoginForm({
  onLoggedIn,
  onNav,
}: {
  onLoggedIn: (u: SessionUser) => void;
  onNav: (v: View) => void;
}) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setError("");
    setBusy(true);
    const res = await login(username, password);
    setBusy(false);
    if ("user" in res) onLoggedIn(res.user);
    else setError(res.error);
  };

  return (
    <>
      <div className="form-grid">
        <div className="field">
          <label>아이디</label>
          <input
            className="input"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="아이디 (admin 또는 가입한 아이디)"
            autoCapitalize="none"
            autoComplete="username"
          />
        </div>
        <div className="field">
          <label>비밀번호</label>
          <input
            className="input"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && submit()}
            placeholder="비밀번호"
            autoComplete="current-password"
          />
        </div>
        {error && <p className="form-error">{error}</p>}
        <button className="btn amber" disabled={busy} onClick={submit}>
          {busy ? "로그인 중…" : "로그인"}
        </button>
      </div>
      <div className="login-links">
        <button onClick={() => onNav("signup")}>회원가입</button>
        <span>·</span>
        <button onClick={() => onNav("findId")}>아이디 찾기</button>
        <span>·</span>
        <button onClick={() => onNav("findPw")}>비밀번호 찾기</button>
      </div>
    </>
  );
}

/* ---------------- 회원가입 ---------------- */
function SignupForm({ onNav }: { onNav: (v: View) => void }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [part, setPart] = useState("기타");
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setError("");
    setBusy(true);
    const res = await signup({
      username,
      password,
      name,
      phone,
      email,
      part,
    });
    setBusy(false);
    if ("ok" in res) setDone(true);
    else setError(res.error);
  };

  if (done) {
    return (
      <>
        <div className="card" style={{ textAlign: "center" }}>
          <div style={{ fontSize: 32 }}>✅</div>
          <p style={{ fontWeight: 700, margin: "8px 0 4px" }}>가입 신청이 접수되었습니다</p>
          <p className="dim" style={{ fontSize: 13, margin: 0 }}>
            관리자 승인 후 로그인할 수 있어요.
          </p>
        </div>
        <button className="btn amber" style={{ width: "100%", marginTop: 12 }} onClick={() => onNav("login")}>
          로그인 화면으로
        </button>
      </>
    );
  }

  return (
    <>
      <div className="form-grid">
        <div className="field">
          <label>아이디</label>
          <input className="input" value={username} onChange={(e) => setUsername(e.target.value)} placeholder="영문소문자·숫자·_ 3~20자" autoCapitalize="none" />
        </div>
        <div className="field">
          <label>비밀번호</label>
          <input className="input" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="4자 이상" />
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
          <label>담당 파트</label>
          <select className="select" value={part} onChange={(e) => setPart(e.target.value)}>
            <option>기타</option>
            <option>베이스</option>
            <option>드럼</option>
            <option>보컬</option>
            <option>키보드</option>
            <option>기타 파트</option>
          </select>
        </div>
        {error && <p className="form-error">{error}</p>}
        <button className="btn amber" disabled={busy} onClick={submit}>
          {busy ? "신청 중…" : "가입 신청"}
        </button>
      </div>
      <div className="login-links">
        <button onClick={() => onNav("login")}>← 로그인으로 돌아가기</button>
      </div>
    </>
  );
}

/* ---------------- 아이디 찾기 ---------------- */
function FindIdForm({ onNav }: { onNav: (v: View) => void }) {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [fallback, setFallback] = useState<string[] | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setError("");
    setSent(false);
    setFallback(null);
    setBusy(true);
    const res = await findUsername(email);
    setBusy(false);
    if ("error" in res) {
      setError(res.error);
    } else if (res.sent) {
      setSent(true);
    } else {
      setFallback(res.usernames ?? []);
    }
  };

  return (
    <>
      <div className="form-grid">
        <div className="field">
          <label>이메일</label>
          <input className="input" type="email" inputMode="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="가입 시 입력한 이메일" autoCapitalize="none" autoComplete="email" />
        </div>
        {error && <p className="form-error">{error}</p>}
        {sent && (
          <div className="card" style={{ margin: 0, textAlign: "center" }}>
            <div style={{ fontSize: 28 }}>📧</div>
            <p style={{ fontWeight: 700, margin: "6px 0 2px" }}>아이디를 이메일로 보냈습니다</p>
            <p className="dim" style={{ fontSize: 12, margin: 0 }}>받은 편지함을 확인하세요.</p>
          </div>
        )}
        {fallback && (
          <div className="card" style={{ margin: 0 }}>
            <p className="dim" style={{ fontSize: 12, margin: "0 0 4px" }}>회원님의 아이디 (이메일 미설정 — 화면 표시)</p>
            {fallback.map((u) => (
              <div key={u} className="m-name" style={{ fontSize: 16 }}>
                {u}
              </div>
            ))}
          </div>
        )}
        <button className="btn amber" disabled={busy} onClick={submit}>
          {busy ? "조회 중…" : "아이디 메일로 받기"}
        </button>
      </div>
      <div className="login-links">
        <button onClick={() => onNav("login")}>← 로그인으로 돌아가기</button>
        <span>·</span>
        <button onClick={() => onNav("findPw")}>비밀번호 찾기</button>
      </div>
    </>
  );
}

/* ---------------- 비밀번호 재설정 ---------------- */
function FindPwForm({ onNav }: { onNav: (v: View) => void }) {
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [sent, setSent] = useState(false);
  const [tempPassword, setTempPassword] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setError("");
    setBusy(true);
    const res = await resetPassword({ username, email });
    setBusy(false);
    if ("error" in res) {
      setError(res.error);
    } else if (res.sent) {
      setSent(true);
    } else {
      setTempPassword(res.tempPassword ?? "");
    }
  };

  if (sent || tempPassword !== null) {
    return (
      <>
        <div className="card" style={{ textAlign: "center" }}>
          <div style={{ fontSize: 32 }}>🔑</div>
          <p style={{ fontWeight: 700, margin: "8px 0 4px" }}>임시 비밀번호를 발급했습니다</p>
          {sent ? (
            <p className="dim" style={{ fontSize: 13, margin: 0 }}>
              이메일로 임시 비밀번호를 보냈습니다. 로그인 후 변경하세요.
            </p>
          ) : (
            <>
              <p className="dim" style={{ fontSize: 12, margin: "0 0 6px" }}>
                이메일 미설정 — 화면에 표시합니다
              </p>
              <div className="m-name" style={{ fontSize: 18, letterSpacing: 1 }}>{tempPassword}</div>
            </>
          )}
        </div>
        <button className="btn amber" style={{ width: "100%", marginTop: 12 }} onClick={() => onNav("login")}>
          로그인 화면으로
        </button>
      </>
    );
  }

  return (
    <>
      <div className="form-grid">
        <div className="field">
          <label>아이디</label>
          <input className="input" value={username} onChange={(e) => setUsername(e.target.value)} placeholder="아이디" autoCapitalize="none" autoComplete="username" />
        </div>
        <div className="field">
          <label>이메일</label>
          <input className="input" type="email" inputMode="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="가입 시 입력한 이메일" autoCapitalize="none" autoComplete="email" />
        </div>
        {error && <p className="form-error">{error}</p>}
        <button className="btn amber" disabled={busy} onClick={submit}>
          {busy ? "발송 중…" : "임시 비밀번호 메일로 받기"}
        </button>
      </div>
      <div className="login-links">
        <button onClick={() => onNav("login")}>← 로그인으로 돌아가기</button>
        <span>·</span>
        <button onClick={() => onNav("findId")}>아이디 찾기</button>
      </div>
    </>
  );
}
