-- ============================================================
-- GUITAR TOGETHER — Supabase 스키마 + 시드 데이터
-- Supabase 대시보드 → SQL Editor 에 붙여넣고 Run 하세요.
-- (lib/types.ts 의 인터페이스와 컬럼이 1:1 매핑됩니다)
-- ============================================================

-- ---------- 테이블 ----------
create table if not exists boards (
  id text primary key default gen_random_uuid()::text,
  name text not null,
  is_notice boolean not null default false,     -- 공지사항 게시판(고정글이 홈에 노출)
  created_at timestamptz not null default now()
);

create table if not exists posts (
  id text primary key default gen_random_uuid()::text,
  board_id text not null references boards(id) on delete cascade,
  title text not null,
  body text not null,
  author text not null,                         -- 작성자 표시명
  author_id text,                               -- 작성자 회원 id(수정 권한 판별, null=시드/익명)
  pinned boolean not null default false,        -- 상단 고정
  created_at timestamptz not null default now()
);

-- 기존 posts 테이블 업그레이드(재실행 안전) — 작성자 id 컬럼 추가
alter table posts add column if not exists author_id text;

create table if not exists reservations (
  id text primary key default gen_random_uuid()::text,
  date date not null,
  end_date date,                                -- MT(1박2일 등) 종료 날짜. null=당일 예약
  time_label text not null,
  reserved_by text not null,
  purpose text not null default '합주'
);

-- 기존 reservations 테이블 업그레이드(재실행 안전) — MT 여러 날 예약용 종료 날짜
alter table reservations add column if not exists end_date date;

create table if not exists teams (
  id text primary key default gen_random_uuid()::text,
  name text not null,
  sort_order integer not null default 0          -- 탭 표시 순서(운영진 드래그로 변경)
);

-- 기존 teams 테이블 업그레이드(재실행 안전) — 정렬 순서 컬럼 추가
alter table teams add column if not exists sort_order integer not null default 0;

create table if not exists songs (
  id text primary key default gen_random_uuid()::text,
  team_id text not null references teams(id) on delete cascade,
  title text not null,
  artist text not null,
  youtube_url text,                             -- 유튜브 링크
  parts text[] not null default '{}',           -- (레거시)
  sheets jsonb not null default '[]',           -- (레거시)
  likes integer not null default 0,
  voted boolean not null default false,
  status text not null default 'candidate'     -- candidate | confirmed
);

-- 기존 songs 테이블 업그레이드(재실행 안전) — 유튜브 링크 컬럼
alter table songs add column if not exists youtube_url text;

create table if not exists members (
  id text primary key default gen_random_uuid()::text,
  name text not null,
  phone text,                                   -- 휴대폰번호
  email text,                                   -- 이메일(아이디/비밀번호 찾기 발송용)
  part text not null,                           -- 악기1 — 팀1(team_id)에서 담당하는 파트
  part2 text,                                   -- 악기2 — 팀2(team_id_2) 담당 파트 (null=악기1과 동일)
  status text not null default 'active',        -- active | rest
  role text not null default 'member',          -- admin | president | treasurer | staff | member
  initial text not null,
  username text unique,                         -- 로그인 아이디
  approved boolean not null default false,      -- 관리자 승인 여부 (false=가입 대기)
  team_id text references teams(id) on delete set null,  -- 소속 팀1(운영진 배정, null=미배정)
  team_id_2 text references teams(id) on delete set null  -- 소속 팀2(한 사람이 2개 팀 참여, null=없음)
);

-- 기존 members 테이블 업그레이드(재실행 안전) — 새 컬럼 추가
alter table members add column if not exists role text not null default 'member';
alter table members add column if not exists username text unique;
alter table members add column if not exists approved boolean not null default false;
alter table members add column if not exists team_id text references teams(id) on delete set null;
alter table members add column if not exists team_id_2 text references teams(id) on delete set null;
alter table members add column if not exists phone text;
alter table members add column if not exists email text;
alter table members add column if not exists part2 text;
-- 기수(cohort) 미사용 전환 — 기존 컬럼이 있으면 not null 제약 해제(회원가입 시 미입력)
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_name = 'members' and column_name = 'cohort'
  ) then
    alter table members alter column cohort drop not null;
  end if;
end $$;
create index if not exists members_email_idx on members (lower(email));

-- 자격증명(비밀번호 해시) — 공개 members 와 분리, anon 접근 차단(아래 RLS).
-- service_role 키(서버 전용)로만 접근 → 비밀번호는 절대 클라이언트로 노출되지 않음.
create table if not exists member_auth (
  member_id text primary key references members(id) on delete cascade,
  password text not null                        -- scrypt 해시 ("salt:hash")
);

-- dues/expenses: 사용 중단 — 회비 페이지가 구글시트 연동(lib/sheet.ts)으로 전환됨. 과거 데이터 보존용.
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

-- 웹푸시 구독 — 공지 작성 시 알림 발송 대상. service_role(서버)로만 접근.
create table if not exists push_subscriptions (
  endpoint text primary key,
  p256dh text not null,
  auth text not null,
  member_id text,                               -- 구독한 회원 id (운영진 대상 발송 필터용)
  created_at timestamptz not null default now()
);

-- 기존 push_subscriptions 테이블 업그레이드(재실행 안전) — 구독 회원 연결
alter table push_subscriptions add column if not exists member_id text;

-- 안되는 일정(불참) 체크 — 회원이 2주 단위로 안되는 날 표시. 팀별 조회. service_role 접근.
create table if not exists unavailable_dates (
  member_id text not null references members(id) on delete cascade,
  date date not null,
  primary key (member_id, date)
);

-- ---------- RLS (Row Level Security) ----------
-- ⚠️ 현재는 인증(로그인)이 없으므로 anon 에게 읽기/쓰기를 모두 허용합니다.
--    운영 전환 시 Supabase Auth 를 붙이고 정책을 사용자 기준으로 조이세요.
alter table boards        enable row level security;
alter table posts         enable row level security;
alter table reservations  enable row level security;
alter table teams         enable row level security;
alter table songs         enable row level security;
alter table members       enable row level security;
alter table dues          enable row level security;
alter table expenses      enable row level security;

-- member_auth: RLS 활성화 + 공개 정책 없음 → anon 접근 전면 차단.
-- (service_role 키는 RLS 를 우회하므로 서버 인증 로직만 접근 가능)
alter table member_auth   enable row level security;

-- push_subscriptions: RLS 활성화 + 공개 정책 없음 → 서버(service_role)만 접근
alter table push_subscriptions enable row level security;

-- unavailable_dates: RLS 활성화 + 공개 정책 없음 → 서버(service_role)만 접근
alter table unavailable_dates enable row level security;

do $$
declare t text;
begin
  foreach t in array array['boards','posts','reservations','teams','songs','dues','expenses']
  loop
    execute format('drop policy if exists "public_all" on %I;', t);
    execute format('create policy "public_all" on %I for all using (true) with check (true);', t);
  end loop;
end $$;

-- ---------- 시드 데이터 ----------
-- ⚠️ 데모(시드) 콘텐츠는 넣지 않습니다. 재실행해도 이전 데이터가 다시 생기지 않게,
--    구조에 꼭 필요한 게시판(공지/자유)과 기본 팀(1~3팀)만 do nothing 으로 시드합니다.
--    (do nothing = 이미 있으면 건드리지 않음 → 이름 변경/삭제가 재실행으로 되돌아가지 않음)

-- 기본 게시판: 공지사항(홈 고정공지)·자유게시판·건의사항(익명) — 앱 구조상 필요
insert into boards (id, name, is_notice, created_at) values
  ('b1','공지사항',true,'2026-01-01T00:00:00Z'),
  ('b2','자유게시판',false,'2026-02-01T00:00:00Z'),
  ('b3','건의사항',false,'2026-03-01T00:00:00Z')
on conflict (id) do nothing;

-- 기본 팀(1~3팀) — 신규 설치 편의용. 기존에 있으면 그대로 둠.
insert into teams (id, name) values
  ('t1','1팀'),('t2','2팀'),('t3','3팀')
on conflict (id) do nothing;

-- posts / reservations / songs / dues / expenses 는 시드하지 않음(운영 데이터로만 채움).
