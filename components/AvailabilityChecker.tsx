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

  // 일정 보기 팝업 — 팀 선택 탭 + 월 캘린더(녹색 = 모두 가능, 빨강 = 안되는 사람 있음)
  const [showList, setShowList] = useState(false);
  const [listBusy, setListBusy] = useState(false);
  const [teamGroups, setTeamGroups] = useState<
    { teamId: string; teamName: string; days: { date: string; names: string[] }[] }[]
  >([]);
  const [listError, setListError] = useState("");
  const [activeListTeam, setActiveListTeam] = useState("");
  const [listMonth, setListMonth] = useState<Date>(
    () => new Date(today.getFullYear(), today.getMonth(), 1),
  );
  const [openDay, setOpenDay] = useState<string | null>(null); // 이름을 펼쳐 보는 날짜

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
    setActiveListTeam(res.teams[0]?.teamId ?? "");
    setListMonth(new Date(today.getFullYear(), today.getMonth(), 1));
    setOpenDay(null);
  };

  // 현재 선택한 팀의 날짜별 안되는 사람 목록
  const namesByDate = useMemo(() => {
    const g = teamGroups.find((t) => t.teamId === activeListTeam);
    return new Map((g?.days ?? []).map((d) => [d.date, d.names]));
  }, [teamGroups, activeListTeam]);

  // 일정 보기 캘린더의 날짜 칸 (앞쪽 빈칸 + 그 달의 날짜들)
  const listMonthCells = useMemo(() => {
    const y = listMonth.getFullYear();
    const m = listMonth.getMonth();
    const blanks = new Date(y, m, 1).getDay();
    const count = new Date(y, m + 1, 0).getDate();
    return { blanks, dates: Array.from({ length: count }, (_, i) => new Date(y, m, i + 1)) };
  }, [listMonth]);

  const openNames = openDay ? (namesByDate.get(openDay) ?? []) : [];

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
            ) : (
              <>
                {/* 두 팀 소속이면 팀 선택 탭 */}
                {teamGroups.length > 1 && (
                  <div className="tab-row" style={{ marginTop: 10 }}>
                    {teamGroups.map((g) => (
                      <button
                        key={g.teamId}
                        className={`tab${activeListTeam === g.teamId ? " active" : ""}`}
                        onClick={() => {
                          setActiveListTeam(g.teamId);
                          setOpenDay(null);
                        }}
                      >
                        {g.teamName} 보기
                      </button>
                    ))}
                  </div>
                )}

                {/* 월 캘린더 */}
                <div className="cal-head" style={{ marginTop: 10 }}>
                  <button
                    className="cal-nav"
                    onClick={() => {
                      setListMonth((m) => new Date(m.getFullYear(), m.getMonth() - 1, 1));
                      setOpenDay(null);
                    }}
                    aria-label="이전 달"
                  >
                    ‹
                  </button>
                  <span className="cal-title">{listMonth.getFullYear()}년 {listMonth.getMonth() + 1}월</span>
                  <button
                    className="cal-nav"
                    onClick={() => {
                      setListMonth((m) => new Date(m.getFullYear(), m.getMonth() + 1, 1));
                      setOpenDay(null);
                    }}
                    aria-label="다음 달"
                  >
                    ›
                  </button>
                </div>

                <div className="av-grid" style={{ marginTop: 8 }}>
                  {DOW.map((d) => (
                    <div key={d} className="av-dow">{d}</div>
                  ))}
                  {Array.from({ length: listMonthCells.blanks }, (_, i) => (
                    <div key={`blank-${i}`} />
                  ))}
                  {listMonthCells.dates.map((d) => {
                    const ymd = toYmd(d);
                    const past = ymd < todayYmd;
                    const busy = (namesByDate.get(ymd) ?? []).length > 0;
                    const cls = past ? " past" : busy ? " busy" : " free";
                    return (
                      <button
                        key={ymd}
                        className={`av-cell${cls}${openDay === ymd ? " open" : ""}`}
                        disabled={past || !busy}
                        onClick={() => setOpenDay((prev) => (prev === ymd ? null : ymd))}
                        title={ymd === todayYmd ? "오늘" : ""}
                      >
                        {d.getDate()}
                      </button>
                    );
                  })}
                </div>

                <p className="dim" style={{ fontSize: 11, margin: "10px 0 0" }}>
                  녹색 = 모두 가능 · 빨강 = 안되는 사람 있음. 빨간 날짜를 누르면 이름이 표시됩니다.
                </p>

                {/* 선택한 날짜의 안되는 사람 — 같은 날짜를 다시 누르면 닫힘 */}
                {openDay && openNames.length > 0 && (
                  <div style={{ marginTop: 10, padding: "10px 12px", border: "1px solid var(--border)", borderRadius: 10 }}>
                    <div className="m-name" style={{ fontSize: 14 }}>{fmtListDate(openDay)}</div>
                    <div className="dim" style={{ fontSize: 13, marginTop: 2 }}>
                      {openNames.join(", ")} <span style={{ opacity: 0.6 }}>({openNames.length}명 불참)</span>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}
