"use client";

import { useEffect } from "react";

/**
 * 작성·수정 폼이나 편집 팝업이 열려 있는 동안 LiveRefresh 자동 동기화를
 * 보류하기 위한 전역 카운터. (입력창 포커스가 없는 순간에도 보호된다.)
 */
let holds = 0;

export function hasRefreshHold() {
  return holds > 0;
}

/** active인 동안 자동 동기화를 보류한다. 언마운트/해제 시 cleanup으로 반드시 풀린다. */
export function useRefreshHold(active: boolean) {
  useEffect(() => {
    if (!active) return;
    holds += 1;
    return () => {
      holds -= 1;
    };
  }, [active]);
}
