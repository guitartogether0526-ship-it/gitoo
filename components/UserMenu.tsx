"use client";

import Link from "next/link";
import { useAuth } from "@/lib/auth";
import { ROLE_LABEL } from "@/lib/roles";

export default function UserMenu() {
  const { user, logout } = useAuth();
  if (!user) return null;

  return (
    <div className="user-menu">
      <Link href="/mypage" className="btn ghost btn-sm" aria-label="마이페이지">
        마이페이지
      </Link>
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
