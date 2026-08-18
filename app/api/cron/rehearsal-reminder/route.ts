import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { sendToMembers } from "@/lib/push";
import { kstYmd } from "@/lib/date";

export const dynamic = "force-dynamic";

/**
 * 합주 당일 리마인더 — Vercel Cron이 매일 13:00 KST(04:00 UTC)에 호출 (vercel.json).
 *
 * 오늘(KST) 날짜의 용도 "합주" 예약을 찾아:
 *   - 예약자가 팀 이름("6팀" 등)이면 → 그 팀 소속(팀1·팀2) 회원 전체에게
 *   - 예약자가 개인 이름이면 → 그 회원에게
 * 푸시 알림을 보낸다.
 *
 * 보안: Vercel에 CRON_SECRET 환경변수를 설정하면 cron 요청에 자동으로
 * `Authorization: Bearer <CRON_SECRET>` 헤더가 붙는다. 미설정이면 호출 거부 —
 * 조건부로 열어두면 env 누락 시 누구나 GET으로 전 회원에게 푸시를 쏠 수 있다.
 */
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const sb = getSupabaseAdmin();
  if (!sb) return NextResponse.json({ error: "DB 미설정" }, { status: 500 });

  const today = kstYmd();
  const { data: reservations } = await sb
    .from("reservations")
    .select("time_label,reserved_by")
    .eq("date", today)
    .eq("purpose", "합주");

  if (!reservations || reservations.length === 0) {
    return NextResponse.json({ ok: true, date: today, reservations: 0, sent: 0 });
  }

  const [{ data: teams }, { data: members }] = await Promise.all([
    sb.from("teams").select("id,name"),
    sb.from("members").select("id,name,team_id,team_id_2,team_id_3"),
  ]);

  let sent = 0;
  for (const r of reservations) {
    const team = (teams ?? []).find((t) => t.name === r.reserved_by);
    const ids = team
      ? (members ?? [])
          .filter(
            (m) => m.team_id === team.id || m.team_id_2 === team.id || m.team_id_3 === team.id,
          )
          .map((m) => m.id)
      : (members ?? []).filter((m) => m.name === r.reserved_by).map((m) => m.id);
    if (ids.length === 0) continue;

    const res = await sendToMembers(ids, {
      title: "🎸 오늘 합주 있는 날",
      body: `${r.reserved_by} · ${r.time_label} 연습실`,
      url: "/reservation",
    });
    sent += res.sent;
  }

  return NextResponse.json({ ok: true, date: today, reservations: reservations.length, sent });
}
