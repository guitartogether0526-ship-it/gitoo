"use client";

import { useEffect } from "react";

/** sw.js 등록 — PWA 오프라인 앱 셸 캐싱 */
export default function ServiceWorkerRegister() {
  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {
        /* 등록 실패는 무시 (개발 중에는 정상) */
      });
    }
  }, []);
  return null;
}
