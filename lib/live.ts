// 실시간 반영 — 서버·브라우저 공용 상수.
// 채널을 둘로 나눈다 — 한쪽 설정 문제가 다른 쪽 신호까지 끊지 않도록.
//  - LIVE_DB_CHANNEL: 공개 읽기(RLS public_all) 테이블의 DB 변경 신호(postgres_changes). DB가 보내므로 위조 불가.
//  - LIVE_CHANNEL: 권한을 막아 둔 테이블(좋아요·안되는 날·회원·app_settings)의 "바뀌었음" 방송.
//    비공개 채널 — 받기만 누구나(anon), 보내기는 서버(service_role)만 (supabase/schema.sql 의 realtime.messages 정책).
export const LIVE_DB_CHANNEL = "gitoo-db";
export const LIVE_CHANNEL = "gitoo-live";
/** 브라우저 안 알림 — 직접 데이터를 불러오는 화면(안되는 날 등)이 듣는다. detail = 테이블 이름 */
export const LIVE_EVENT = "gitoo:live";
/** postgres_changes 로 구독하는 테이블 — supabase/schema.sql 의 supabase_realtime publication 과 같아야 한다 */
export const LIVE_TABLES = ["reservations", "posts", "boards", "songs", "teams"] as const;
