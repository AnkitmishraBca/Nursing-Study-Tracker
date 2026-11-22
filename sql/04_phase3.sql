-- ============================================================================
-- BSc Nursing & NORCET Study Tracker — Phase 3 (AI Doubt Solver + Panic Revision)
-- Run this in Supabase SQL Editor AFTER 01_schema.sql, 02_seed.sql and 03_ai_notes.sql.
-- Phase 1 & 2 schema ko chheda nahi gaya — sirf 2 naye tables add ho rahe hain.
-- ============================================================================

-- ---------- 1. Doubt Solver chat history ----------
create table if not exists ai_doubts (
  id text primary key,
  user_id text not null default 'me',
  question text not null,
  answer text not null default '',
  provider text,
  model text,
  language text not null default 'en',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists ai_doubts_created_idx on ai_doubts (created_at desc);

drop trigger if exists trg_ai_doubts_touch on ai_doubts;
create trigger trg_ai_doubts_touch before update on ai_doubts for each row execute function touch_updated_at();

alter table ai_doubts enable row level security;

drop policy if exists single_user_access on ai_doubts;
create policy single_user_access on ai_doubts
  for all to anon, authenticated
  using (user_id = 'me')
  with check (user_id = 'me');

-- ---------- 2. 5-minute panic revision sheets ----------
create table if not exists ai_panic_sessions (
  id text primary key,
  user_id text not null default 'me',
  subject_id text,
  subject_name text not null default '',
  content text not null default '',
  provider text,
  model text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists ai_panic_created_idx on ai_panic_sessions (created_at desc);

drop trigger if exists trg_ai_panic_touch on ai_panic_sessions;
create trigger trg_ai_panic_touch before update on ai_panic_sessions for each row execute function touch_updated_at();

alter table ai_panic_sessions enable row level security;

drop policy if exists single_user_access on ai_panic_sessions;
create policy single_user_access on ai_panic_sessions
  for all to anon, authenticated
  using (user_id = 'me')
  with check (user_id = 'me');

-- ---------- grants ----------
grant usage on schema public to anon, authenticated;
grant select, insert, update, delete on ai_doubts to anon, authenticated;
grant select, insert, update, delete on ai_panic_sessions to anon, authenticated;
