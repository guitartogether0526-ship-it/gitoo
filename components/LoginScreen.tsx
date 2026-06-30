"use client";

import { useState } from "react";
import type { Member, MemberRole, SessionUser } from "@/lib/types";
import { ROLE_LABEL } from "@/lib/roles";
import { useAuth } from "@/lib/auth";
import { ADMIN_USER } from "@/lib/admin";
import { loginAdmin } from "@/lib/auth-actions";
import Logo from "./Logo";

const ROLE_BADGE: Record<MemberRole, string> = {
  admin: "amber",
  president: "amber",
  treasurer: "amber",
  staff: "ok",
  member: "",
};

export default function LoginScreen({ members }: { members: Member[] }) {
  const { login } = useAuth();
  const [selected, setSelected] = useState<string>("admin");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const sorted = members.slice().sort((a, b) => a.name.localeCompare(b.name, "ko"));

  const toSession = (m: Member): SessionUser => ({
    id: m.id,
    name: m.name,
    role: m.role,
    part: m.part,
    cohort: m.cohort,
    initial: m.initial,
  });

  const submit = async () => {
    setError("");
    if (selected === "admin") {
      if (!password) return;
      setBusy(true);
      const user = await loginAdmin(password);
      setBusy(false);
      if (user) login(user);
      else setError("비밀번호가 올바르지 않습니다.");
      return;
    }
    const m = sorted.find((x) => x.id === selected);
    if (m) login(toSession(m));
  };

  return (
    <div className="login-screen">
      <div className="login-card">
        <div className="login-head">
          <Logo />
          <h1>GUITAR TOGETHER</h1>
          <p className="dim">계정을 선택해 로그인하세요</p>
        </div>

        <div className="login-list">
          {/* 관리자 계정 (비밀번호 필요) */}
          <button
            className={`login-item${selected === "admin" ? " active" : ""}`}
            onClick={() => {
              setSelected("admin");
              setError("");
            }}
          >
            <span className="avatar">{ADMIN_USER.initial}</span>
            <span className="grow" style={{ textAlign: "left" }}>
              <span className="m-name">{ADMIN_USER.name}</span>
              <span className="dim" style={{ fontSize: 12, marginLeft: 6 }}>
                모든 권한 · 비밀번호 필요
              </span>
            </span>
            <span className={`badge ${ROLE_BADGE.admin}`}>{ROLE_LABEL.admin}</span>
          </button>

          {/* 일반 회원 (비밀번호 없이 선택 로그인) */}
          {sorted.map((m) => (
            <button
              key={m.id}
              className={`login-item${selected === m.id ? " active" : ""}`}
              onClick={() => {
                setSelected(m.id);
                setError("");
              }}
            >
              <span className="avatar">{m.initial}</span>
              <span className="grow" style={{ textAlign: "left" }}>
                <span className="m-name">{m.name}</span>
                <span className="dim" style={{ fontSize: 12, marginLeft: 6 }}>
                  {m.cohort}기 · {m.part}
                </span>
              </span>
              <span className={`badge ${ROLE_BADGE[m.role]}`}>{ROLE_LABEL[m.role]}</span>
            </button>
          ))}
        </div>

        {selected === "admin" && (
          <div className="field" style={{ marginBottom: 12 }}>
            <label>관리자 비밀번호</label>
            <input
              className="input"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && submit()}
              placeholder="비밀번호 입력"
              autoComplete="current-password"
            />
          </div>
        )}

        {error && (
          <p style={{ color: "var(--danger)", fontSize: 12, margin: "0 0 10px" }}>{error}</p>
        )}

        <button
          className="btn amber"
          style={{ width: "100%" }}
          disabled={busy || (selected === "admin" && !password)}
          onClick={submit}
        >
          {busy ? "확인 중…" : "로그인"}
        </button>

        <p className="dim" style={{ fontSize: 11, textAlign: "center", marginTop: 12 }}>
          권한(관리자 · 회장 · 총무 · STAFF · 회원)에 따라 사용할 수 있는 기능이 달라집니다.
        </p>
      </div>
    </div>
  );
}
