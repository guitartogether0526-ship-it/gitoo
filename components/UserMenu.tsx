"use client";

import { useAuth } from "@/lib/auth";
import { ROLE_LABEL } from "@/lib/roles";

export default function UserMenu() {
  const { user, logout } = useAuth();
  if (!user) return null;

  return (
    <div className="user-menu">
      <div className="user-meta">
        <span className="user-name">{user.name}</span>
        <span className="user-role">{ROLE_LABEL[user.role]}</span>
      </div>
      <button className="btn ghost btn-sm" onClick={logout} aria-label="로그아웃">
        로그아웃
      </button>
    </div>
  );
}
