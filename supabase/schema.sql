-- ============================================================
-- GUITAR TOGETHER — Supabase 스키마 + 시드 데이터
-- Supabase 대시보드 → SQL Editor 에 붙여넣고 Run 하세요.
-- (lib/types.ts 의 인터페이스와 컬럼이 1:1 매핑됩니다)
-- ============================================================

-- ---------- 테이블 ----------
create table if not exists notices (
  id text primary key default gen_random_uuid()::text,
  title text not null,
  body text not null,
  author text not null,
  pinned boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists reservations (
  id text primary key default gen_random_uuid()::text,
  date date not null,
  time_label text not null,
  reserved_by text not null,
  purpose text not null default '합주'
);

create table if not exists equipment (
  id text primary key default gen_random_uuid()::text,
  name text not null,
  category text not null,
  emoji text not null default '🎸',
  image_url text,
  quantity integer not null default 1,
  status text not null default 'available',   -- available | rented | repair
  rented_by text
);

create table if not exists teams (
  id text primary key default gen_random_uuid()::text,
  name text not null
);

create table if not exists songs (
  id text primary key default gen_random_uuid()::text,
  team_id text not null references teams(id) on delete cascade,
  title text not null,
  artist text not null,
  parts text[] not null default '{}',
  sheets jsonb not null default '[]',
  likes integer not null default 0,
  voted boolean not null default false,
  status text not null default 'candidate'     -- candidate | confirmed
);

create table if not exists members (
  id text primary key default gen_random_uuid()::text,
  name text not null,
  cohort integer not null,
  part text not null,
  status text not null default 'active',        -- active | rest
  is_staff boolean not null default false,
  is_treasurer boolean not null default false,
  initial text not null
);

create table if not exists dues (
  id bigint generated always as identity primary key,
  member_name text not null,
  cohort integer not null,
  paid boolean not null default false,
  month text not null
);

create table if not exists expenses (
  id text primary key default gen_random_uuid()::text,
  date date not null,
  item text not null,
  amount integer not null,                      -- 음수=지출, 양수=수입
  has_receipt boolean not null default false
);

-- ---------- RLS (Row Level Security) ----------
-- ⚠️ 현재는 인증(로그인)이 없으므로 anon 에게 읽기/쓰기를 모두 허용합니다.
--    운영 전환 시 Supabase Auth 를 붙이고 정책을 사용자 기준으로 조이세요.
alter table notices       enable row level security;
alter table reservations  enable row level security;
alter table equipment     enable row level security;
alter table teams         enable row level security;
alter table songs         enable row level security;
alter table members       enable row level security;
alter table dues          enable row level security;
alter table expenses      enable row level security;

do $$
declare t text;
begin
  foreach t in array array['notices','reservations','equipment','teams','songs','members','dues','expenses']
  loop
    execute format('drop policy if exists "public_all" on %I;', t);
    execute format('create policy "public_all" on %I for all using (true) with check (true);', t);
  end loop;
end $$;

-- ---------- 시드 데이터 ----------
insert into notices (id, title, body, author, pinned, created_at) values
  ('n1','🎸 6월 정기 합주 일정 안내','이번 달 정기 합주는 6월 28일(토) 오후 3시, 1번 연습실에서 진행됩니다. 셋리스트 투표를 미리 마감해 주세요!','운영진 김지윤',true,'2026-06-25T09:00:00Z'),
  ('n2','신규 앰프 도입 완료','Fender 65 Deluxe Reverb 앰프가 비품 목록에 추가되었습니다. 사용 후 전원 확인 부탁드려요.','총무 박서준',false,'2026-06-20T12:30:00Z'),
  ('n3','회비 납부 안내 (6월)','6월 회비(월 20,000원) 납부 기한은 6월 30일입니다. 미납 회원분들은 총무에게 문의 바랍니다.','총무 박서준',false,'2026-06-15T08:00:00Z')
on conflict (id) do nothing;

insert into reservations (id, date, time_label, reserved_by, purpose) values
  ('rv1','2026-06-28','15:00 - 18:00','록 밴드 A','정기 합주'),
  ('rv2','2026-06-30','19:00 - 21:00','나','개인 연습'),
  ('rv3','2026-07-02','20:00 - 22:00','어쿠스틱 팀','합주'),
  ('rv4','2026-07-05','14:00 - 16:00','이도윤','개인 연습'),
  ('rv5','2026-07-05','18:00 - 20:00','재즈 합주반','합주')
on conflict (id) do nothing;

insert into equipment (id, name, category, emoji, image_url, quantity, status, rented_by) values
  ('e1','다이나믹 마이크 SM58','음향','🎤',null,4,'available',null),
  ('e2','마샬 기타 앰프 DSL40','앰프','🔊',null,2,'rented','이도윤'),
  ('e3','베이스 앰프 Rumble 100','앰프','🔊',null,1,'available',null),
  ('e4','어쿠스틱 기타 (야마하 FG800)','기타','🎸',null,3,'available',null),
  ('e5','일렉 기타 (펜더 스트라토캐스터)','기타','🎸',null,2,'repair',null),
  ('e6','케이블 (10m, 캐논)','케이블','🔌',null,12,'available',null),
  ('e7','튜너 페달 (보스 TU-3)','이펙터','🎛️',null,2,'available',null),
  ('e8','하드케이스 (일렉용)','기타','🧳',null,5,'rented','최하은')
on conflict (id) do nothing;

insert into teams (id, name) values
  ('t1','록 밴드 A'),('t2','어쿠스틱 팀'),('t3','재즈 합주반')
on conflict (id) do nothing;

insert into songs (id, team_id, title, artist, parts, sheets, likes, voted, status) values
  ('s1','t1','Bohemian Rhapsody','Queen',
    array['보컬','기타1','기타2','베이스','드럼','키보드'],
    '[{"part":"기타1","file_label":"Guitar 1 TAB","file_url":"#guitar1-bohemian"},{"part":"베이스","file_label":"Bass Score","file_url":"#bass-bohemian"},{"part":"키보드","file_label":"Piano Sheet","file_url":"#piano-bohemian"}]'::jsonb,
    18,false,'confirmed'),
  ('s2','t1','Don''t Look Back in Anger','Oasis',
    array['보컬','기타1','기타2','베이스','드럼'],
    '[{"part":"기타1","file_label":"Guitar 1 TAB","file_url":"#guitar1-oasis"},{"part":"기타2","file_label":"Guitar 2 TAB","file_url":"#guitar2-oasis"}]'::jsonb,
    24,true,'candidate'),
  ('s3','t2','밤편지','아이유',
    array['보컬','기타','베이스','드럼'],
    '[{"part":"기타","file_label":"Guitar Chord","file_url":"#guitar-iu"},{"part":"보컬","file_label":"Vocal Lead Sheet","file_url":"#vocal-iu"}]'::jsonb,
    31,false,'confirmed'),
  ('s4','t2','사랑했지만','김광석',
    array['보컬','기타','하모니카'],
    '[{"part":"기타","file_label":"Guitar Chord","file_url":"#guitar-kgs"}]'::jsonb,
    12,false,'candidate'),
  ('s5','t3','Fly Me to the Moon','Frank Sinatra',
    array['보컬','기타','베이스','드럼','키보드'],
    '[{"part":"키보드","file_label":"Lead Sheet","file_url":"#piano-fly"}]'::jsonb,
    9,false,'candidate')
on conflict (id) do nothing;

insert into members (id, name, cohort, part, status, is_staff, is_treasurer, initial) values
  ('m1','김지윤',12,'보컬','active',true,false,'지'),
  ('m2','박서준',12,'기타','active',true,true,'서'),
  ('m3','이도윤',14,'베이스','active',false,false,'도'),
  ('m4','정민서',15,'드럼','rest',false,false,'민'),
  ('m5','최하은',14,'키보드','active',false,false,'하')
on conflict (id) do nothing;

insert into dues (member_name, cohort, paid, month) values
  ('김지윤',12,true,'2026-06'),
  ('박서준',12,true,'2026-06'),
  ('이도윤',14,true,'2026-06'),
  ('정민서',15,false,'2026-06'),
  ('최하은',14,false,'2026-06');

insert into expenses (id, date, item, amount, has_receipt) values
  ('x1','2026-06-01','6월 회비 수입 (5명)',100000,false),
  ('x2','2026-06-05','기타 줄 세트 구매',-32000,true),
  ('x3','2026-06-12','연습실 대관료',-60000,true),
  ('x4','2026-06-20','마이크 케이블 추가 구매',-18000,true),
  ('x5','2026-06-22','합주 후 간식비',-24500,true)
on conflict (id) do nothing;
