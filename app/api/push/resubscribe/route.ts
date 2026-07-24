import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { saveSubscription, removeSubscription, type PushSub } from "@/lib/push";

export const dynamic = "force-dynamic";

/**
 * 서비스 워커의 pushsubscriptionchange 처리용 — 브라우저가 푸시 구독을 자동
 * 교체했을 때 새 구독을 저장하고, 기존 구독의 회원 연결(member_id)을 이어받는다.
 * (SW에서는 서버 액션·세션 쿠키를 쓸 수 없어 별도 라우트. member_id는 기존 행에서만
 * 복사하므로 endpoint를 모르는 외부인이 임의 회원에 연결할 수는 없다.)
 */
export async function POST(req: Request) {
  const { old, sub } = (await req.json().catch(() => ({}))) as {
    old?: string | null;
    sub?: PushSub;
  };
  if (!sub?.endpoint || !sub.keys?.p256dh || !sub.keys?.auth) {
    return NextResponse.json({ error: "bad request" }, { status: 400 });
  }

  const sb = getSupabaseAdmin();
  let memberId: string | null = null;
  if (sb && old) {
    const { data } = await sb
      .from("push_subscriptions")
      .select("member_id")
      .eq("endpoint", old)
      .maybeSingle();
    memberId = (data?.member_id as string | null) ?? null;
  }

  await saveSubscription(sub, memberId);
  if (old && old !== sub.endpoint) await removeSubscription(old);
  return NextResponse.json({ ok: true });
}
