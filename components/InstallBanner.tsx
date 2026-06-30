"use client";

import { useEffect, useState } from "react";

/**
 * PWA 설치 안내 바.
 * - beforeinstallprompt 이벤트를 가로채 "홈 화면에 추가" 버튼을 노출.
 * - 개발자 친화 문구 + Git / Vercel 아이콘 포함.
 */

// 최소 타입 (beforeinstallprompt 는 표준 타입에 없음)
interface BIPEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

const GitIcon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-label="Git">
    <circle cx="6" cy="6" r="2.4" />
    <circle cx="6" cy="18" r="2.4" />
    <circle cx="18" cy="9" r="2.4" />
    <path d="M6 8.4v7.2M8.2 7.4l7.6 0M16 11a6 6 0 0 1-6 6" />
  </svg>
);

const VercelIcon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor" aria-label="Vercel">
    <path d="M12 3 22 20H2L12 3Z" />
  </svg>
);

export default function InstallBanner() {
  const [deferred, setDeferred] = useState<BIPEvent | null>(null);
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const onPrompt = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BIPEvent);
    };
    window.addEventListener("beforeinstallprompt", onPrompt);
    return () => window.removeEventListener("beforeinstallprompt", onPrompt);
  }, []);

  if (!visible) return null;

  const handleInstall = async () => {
    if (deferred) {
      await deferred.prompt();
      await deferred.userChoice;
      setDeferred(null);
      setVisible(false);
    }
  };

  return (
    <div className="install-banner" role="status">
      <span className="ib-icons">
        <GitIcon />
        <VercelIcon />
      </span>
      <div className="ib-text">
        <div className="ib-title">홈 화면에 GUITAR TOGETHER 추가</div>
        <div className="ib-sub">Git 동기화 완료 &amp; Vercel 배포 준비 완료</div>
      </div>
      {deferred ? (
        <button className="btn amber btn-sm" onClick={handleInstall}>
          추가
        </button>
      ) : null}
      <button className="ib-close" aria-label="닫기" onClick={() => setVisible(false)}>
        ×
      </button>
    </div>
  );
}
