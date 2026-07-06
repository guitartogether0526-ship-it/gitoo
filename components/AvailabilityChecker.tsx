"use client";

import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/lib/auth";
import { setUnavailable, getMyUnavailable, getTeamUnavailable } from "@/lib/availability-actions";
import { kstParts } from "@/lib/date";

const DOW = ["일", "월", "화", "수", "목", "금", "토"];
const pad = (n: number) => String(n).padStart(2, "0");
const toYmd = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const addDays = (d: Date, n: number) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
const label = (d: Date) => `${d.getMonth() + 1}/${d.getDate()}`;

export default function AvailabilityChecker({
  myTeamNames,
}: {
  myTeamNames: string[];
}) {
  const { user } = useAuth();
  // 두 팀에 속하면 팀명을 함께 표시 (예: "1팀·2팀")
  const teamLabel = myTeamNames.length > 0 ? myTeamNames.join("·") : "내 팀";

  // 오늘 = 한국시간 기준
  const today = useMemo(() => {
    const { y, m, d } = kstParts();
    return new Date(y, m - 1, d);
  }, []);
  const todayYmd = toYmd(today);

  // 이번 주 일요일부터 2주
  const [weekStart, setWeekStart] = useState<Date>(() => addDays(today, -today.getDay()));
  const [myUnavail, setMyUnavail] = useState<Set<string>>(new Set());
  const [error, setError] = useState("");

  // 일정 보기 팝업 — 팀별 섹션으로 표시
  const [showList, setShowList] = useState(false);
  const [listBusy, setListBusy] = useState(false);
  const [teamGroups, setTeamGroups] = useState<
    { teamId: string; teamName: string; days: { date: string; names: string[] }[] }[]
  >([]);
  const [listError, setListError] = useState("");

  useEffect(() => {
    getMyUnavailable()
      .then((dates) => setMyUnavail(new Set(dates)))
      .catch(() => {});
  }, []);

  const days = useMemo(
    () => Array.from({ length: 14 }, (_, i) => addDays(weekStart, i)),
    [weekStart],
  );

  const isMember = !!user && user.id !== "admin";

  const toggle = async (d: Date) => {
    if (!isMember) return;
    const ymd = toYmd(d);
    if (ymd < todayYmd) return; // 지난 날짜 불가
    setError("");
    const has = myUnavail.has(ymd);
    const next = new Set(myUnavail);
    if (has) next.delete(ymd);
    else next.add(ymd);
    setMyUnavail(next);
    const res = await setUnavailable(ymd, !has);
    if ("error" in res) {
      // 롤백
      const rb = new Set(next);
      if (has) rb.add(ymd);
      else rb.delete(ymd);
      setMyUnavail(rb);
      setError(res.error);
    }
  };

  const openList = async () => {
    setListError("");
    setListBusy(true);
    setShowList(true);
    const res = await getTeamUnavailable();
    setListBusy(false);
    if ("error" in res) {
      setListError(res.error);
      setTeamGroups([]);
      return;
    }
    setTeamGroups(res.teams);
  };

  const fmtListDate = (ymd: string) => {
    const [y, m, dd] = ymd.split("-").map(Number);
    const dow = DOW[new Date(y, m - 1, dd).getDay()];
    return `${m}월 ${dd}일 (${dow})`;
  };

  return (
    <>
      <div className="section-title">안되는 일정 체크 (2주)</div>
      <div className="card">
        <div className="cal-head">
          <button className="cal-nav" onClick={() => setWeekStart((w) => addDays(w, -14))} aria-label="이전 2주">‹</button>
          <span className="cal-title">{label(days[0])} ~ {label(days[13])}</span>
          <button className="cal-nav" onClick={() => setWeekStart((w) => addDays(w, 14))} aria-label="다음 2주">›</button>
        </div>

        <div className="av-grid" style={{ marginTop: 10 }}>
          {DOW.map((d) => (
            <div key={d} className="av-dow">{d}</div>
          ))}
          {days.map((d) => {
            const ymd = toYmd(d);
            const past = ymd < todayYmd;
            const on = myUnavail.has(ymd);
            return (
              <button
                key={ymd}
                className={`av-cell${on ? " on" : ""}${past ? " past" : ""}`}
                onClick={() => toggle(d)}
                disabled={past || !isMember}
                title={ymd === todayYmd ? "오늘" : ""}
              >
                {d.getDate()}
              </button>
            );
          })}
        </div>

        {error && <p className="form-error" style={{ marginBottom: 0 }}>{error}</p>}
        <p className="dim" style={{ fontSize: 11, margin: "10px 0 0" }}>
          {isMember
            ? "안되는 날을 눌러 표시하세요(빨간색 = 불참). 다시 누르면 해제됩니다."
            : "로그인한 회원만 표시할 수 있습니다."}
        </p>
        <button className="btn amber" style={{ width: "100%", marginTop: 10 }} onClick={openList}>
          일정 보기 ({teamLabel})
        </button>
      </div>

      {/* 일정 보기 팝업 — 본인 팀만 */}
      {showList && (
        <div className="modal-overlay" onClick={() => setShowList(false)}>
          <div className="card" style={{ margin: 0, width: "100%", maxWidth: 420, maxHeight: "80vh", overflowY: "auto" }} onClick={(e) => e.stopPropagation()}>
            <div className="title-row">
              <div className="section-title" style={{ margin: 0 }}>{teamLabel} 안되는 일정</div>
              <button className="btn ghost btn-sm" onClick={() => setShowList(false)}>닫기</button>
            </div>
            {listBusy ? (
              <p className="dim" style={{ fontSize: 13 }}>불러오는 중…</p>
            ) : listError ? (
              <p className="form-error" style={{ marginBottom: 0 }}>{listError}</p>
            ) : teamGroups.every((g) => g.days.length === 0) ? (
              <p className="dim" style={{ fontSize: 13, marginBottom: 0 }}>표시된 안되는 날이 없습니다.</p>
            ) : (
              teamGroups.map((g) => (
                <div key={g.teamId} style={{ marginTop: 12 }}>
                  {/* 두 팀 소속일 때만 팀명 구분 헤더 표시 (한 팀이면 팝업 제목과 중복) */}
                  {teamGroups.length > 1 && (
                    <div className="m-name" style={{ fontSize: 14, paddingBottom: 4, borderBottom: "1px solid var(--border)" }}>
                      {g.teamName}
                    </div>
                  )}
                  {g.days.length === 0 ? (
                    <p className="dim" style={{ fontSize: 13, margin: "6px 0 0" }}>표시된 안되는 날이 없습니다.</p>
                  ) : (
                    g.days.map((d) => (
                      <div key={d.date} style={{ padding: "8px 0", borderBottom: "1px solid var(--border)" }}>
                        <div className="m-name" style={{ fontSize: 14 }}>{fmtListDate(d.date)}</div>
                        <div className="dim" style={{ fontSize: 13, marginTop: 2 }}>
                          {d.names.join(", ")} <span style={{ opacity: 0.6 }}>({d.names.length}명 불참)</span>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </>
  );
}
