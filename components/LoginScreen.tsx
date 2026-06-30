"use client";

import { useState } from "react";
import type { Member, SessionUser } from "@/lib/types";
import { ROLE_LABEL } from "@/lib/roles";
import { useAuth } from "@/lib/auth";
import Logo from "./Logo";

const ROLE_BADGE: Record<string, string> = {
  president: "amber",
  treasurer: "amber",
  staff: "ok",
  member: "",
};

export default function LoginScreen({ members }: { members: Member[] }) {
  const { login } = useAuth();
  const [selected, setSelected] = useState<string>("");

  const sorted = members
    .slice()
    .sort((a, b) => a.name.localeCompare(b.name, "ko"));

  const signIn = (m: Member) => {
    const user: SessionUser = {
      id: m.id,
      name: m.name,
      role: m.role,
      part: m.part,
      cohort: m.cohort,
      initial: m.initial,
    };
    login(user);
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
          {sorted.map((m) => (
            <button
              key={m.id}
              className={`login-item${selected === m.id ? " active" : ""}`}
              onClick={() => setSelected(m.id)}
            >
              <span className="avatar">{m.initial}</span>
              <span className="grow" style={{ textAlign: "left" }}>
                <span className="m-name">{m.name}</span>
                <span className="dim" style={{ fontSize: 12, marginLeft: 6 }}>
                  {m.cohort}기 · {m.part}
                </span>
              </span>
              <span className={`badge ${ROLE_BADGE[m.role] ?? ""}`}>{ROLE_LABEL[m.role]}</span>
            </button>
          ))}
        </div>

        <button
          className="btn amber"
          style={{ width: "100%" }}
          disabled={!selected}
          onClick={() => {
            const m = sorted.find((x) => x.id === selected);
            if (m) signIn(m);
          }}
        >
          로그인
        </button>

        <p className="dim" style={{ fontSize: 11, textAlign: "center", marginTop: 12 }}>
          권한(회장 · 총무 · STAFF · 회원)에 따라 사용할 수 있는 기능이 달라집니다.
        </p>
      </div>
    </div>
  );
}
