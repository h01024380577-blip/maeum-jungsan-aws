-- 마음정산 Supabase 테이블 생성 SQL
-- Supabase Dashboard → SQL Editor에서 실행하세요

-- contacts 테이블
create table if not exists contacts (
  id uuid default gen_random_uuid() primary key,
  name text not null,
  phone text default '',
  kakao_id text default '',
  relation text default '',
  avatar text default '',
  user_id text not null,
  created_at timestamptz default now()
);

-- entries 테이블
create table if not exists entries (
  id uuid default gen_random_uuid() primary key,
  contact_id text default '',
  event_type text not null,
  type text not null,
  date text not null,
  location text default '',
  target_name text not null,
  account text default '',
  amount integer not null default 0,
  relation text default '',
  recommendation_reason text default '',
  custom_event_name text default '',
  memo text default '',
  user_id text not null,
  created_at timestamptz default now()
);

-- 인덱스
create index if not exists idx_entries_user_id on entries(user_id);
create index if not exists idx_contacts_user_id on contacts(user_id);

-- RLS (Row Level Security) 활성화
alter table contacts enable row level security;
alter table entries enable row level security;

-- 누구나 자신의 device_id로 접근 가능 (anon key 사용)
create policy "Anyone can read own contacts" on contacts for select using (true);
create policy "Anyone can insert contacts" on contacts for insert with check (true);
create policy "Anyone can update own contacts" on contacts for update using (true);
create policy "Anyone can delete own contacts" on contacts for delete using (true);

create policy "Anyone can read own entries" on entries for select using (true);
create policy "Anyone can insert entries" on entries for insert with check (true);
create policy "Anyone can update own entries" on entries for update using (true);
create policy "Anyone can delete own entries" on entries for delete using (true);
