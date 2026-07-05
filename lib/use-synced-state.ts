"use client";

import { useEffect, useState } from "react";

/**
 * 서버 props → 로컬 state 동기화 훅.
 *
 * LiveRefresh(router.refresh)마다 서버가 새 배열 참조를 내려보내는데,
 * 내용이 같은데도 state를 교체하면 목록 전체가 다시 그려져 화면이 깜빡인다.
 * 내용이 같으면 기존 참조를 유지해 React가 리렌더를 건너뛰게 한다.
 * 내용이 실제로 바뀐 경우에만 서버값으로 교체된다.
 */
export function useSyncedState<T>(source: T) {
  const [value, setValue] = useState(source);
  useEffect(() => {
    setValue((prev) => (JSON.stringify(prev) === JSON.stringify(source) ? prev : source));
  }, [source]);
  return [value, setValue] as const;
}
