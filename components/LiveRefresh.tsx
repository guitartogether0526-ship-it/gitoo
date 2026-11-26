"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { hasRefreshHold } from "@/lib/refresh-hold";
import { getSupabase } from "@/lib/supabase";
import { LIVE_CHANNEL, LIVE_DB_CHANNEL, LIVE_EVENT, LIVE_TABLES } from "@/lib/live";
import type { RealtimeChannel } from "@supabase/supabase-js";

/**
 * 라이브 갱신 — 필요한 순간에만 서버 데이터를 다시 불러온다(router.refresh).
 *
 * 정책 (예전의 주기 갱신 — 전 페이지 20초, 회비 60초 — 은 잦은 재렌더가 불편해 폐지):
 *   1. 페이지 이동: Next.js 15는 동적 페이지를 클라이언트 라우터 캐시에 재사용하지
 *      않으므로(staleTimes.dynamic = 0) 이동할 때마다 자동으로 최신 데이터를 받는다
 *      — 별도 코드 불필요.
 *   2. 앱 복귀(백그라운드 → 보임): 모든 페이지에서 1회 갱신.
 *
 *   3. 실시간: 다른 사람이 예약·글·곡·팀·좋아요·회원 정보를 바꾸면 Supabase Realtime 신호로 갱신.
 *
 * ⚠️ iOS Safari는 링크를 탭할 때도 window 'focus'가 발생해 focus는 쓰지 않고,
 *    실제 앱 복귀 신호인 'visibilitychange'(숨김→보임)만 사용하며, 연속 refresh는
 *    최소 간격(MIN_GAP)으로 디바운스한다.
 *
 * ⚠️ 편집/작성 중에는 보류 — 입력창(input·textarea·select·contentEditable)에
 *    포커스가 있거나, 폼/팝업이 열려 있으면(lib/refresh-hold) 미뤘다가 풀리면 갱신한다.
 *    iOS에서 재렌더되면 키보드가 닫히고 한글 조합이 끊기기 때문.
 *
 * 각 목록 컴포넌트는 서버 props가 바뀌면 로컬 상태를 다시 맞추므로(useSyncedState —
 * 내용이 같으면 리렌더 없음), router.refresh 결과가 실제 화면에 그대로 반영된다.
 */
const MIN_GAP = 2000; // 연속 refresh(깜빡임) 방지 최소 간격
const RETRY = 1500; // 입력·팝업 때문에 미룬 갱신을 다시 시도하는 간격
let channelsGone: Promise<unknown> = Promise.resolve(); // 직전 마운트의 채널 정리 완료

export default function LiveRefresh() {
  const router = useRouter();
  const lastRef = useRef(0);

  useEffect(() => {
    let pending = false;
    let timer: ReturnType<typeof setTimeout> | undefined;

    // 작성·수정 폼/팝업이 열려 있거나 입력 중이면 보류 — iOS 키보드·한글 조합 보호
    const blocked = () => {
      if (hasRefreshHold()) return true;
      const el = document.activeElement;
      return (
        el instanceof HTMLElement &&
        (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.tagName === "SELECT" || el.isContentEditable)
      );
    };
    const attempt = () => {
      timer = undefined;
      if (!pending || document.visibilityState !== "visible") return; // 숨김이면 돌아올 때 다시 시도
      const wait = blocked() ? RETRY : lastRef.current + MIN_GAP - Date.now();
      if (wait > 0) {
        timer = setTimeout(attempt, wait);
        return;
      }
      pending = false;
      lastRef.current = Date.now();
      router.refresh();
    };
    const request = () => {
      pending = true;
      if (!timer) attempt();
    };

    // 1) 백그라운드 → 포그라운드로 앱에 다시 돌아왔을 때 (전 페이지 공통)
    const onVisible = () => {
      if (document.visibilityState === "visible") request();
    };
    document.addEventListener("visibilitychange", onVisible);

    // 2) 실시간 — 다른 사람이 바꾸면 신호를 받아 갱신 (채널 2개: lib/live.ts 참고)
    const sb = getSupabase();
    const onChange = (table: string) => {
      window.dispatchEvent(new CustomEvent(LIVE_EVENT, { detail: table }));
      if (table !== "unavailable_dates") request(); // 안되는 날은 그 화면이 직접 다시 불러온다
    };
    let cancelled = false;
    let channels: RealtimeChannel[] = [];
    // 앞 마운트의 채널 정리(비동기)가 끝난 뒤에 새로 연결 — 정리 중인 채널을 재사용하면 곧 닫혀 신호가 끊긴다
    if (sb) {
      channelsGone.then(() => {
        if (cancelled) return;
        const db = sb.channel(LIVE_DB_CHANNEL);
        for (const table of LIVE_TABLES) {
          db.on("postgres_changes", { event: "*", schema: "public", table }, () => onChange(table));
        }
        const live = sb
          .channel(LIVE_CHANNEL, { config: { private: true } })
          .on("broadcast", { event: "changed" }, ({ payload }) => onChange(String(payload?.t ?? "")));
        channels = [db.subscribe(), live.subscribe()];
      });
    }

    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", onVisible);
      if (timer) clearTimeout(timer);
      if (sb && channels.length) {
        const gone = channels;
        channelsGone = Promise.all(gone.map((c) => sb.removeChannel(c))).catch(() => {});
      }
    };
  }, [router]);

  return null;
}
