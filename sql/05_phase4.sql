-- ============================================================================
-- BSc Nursing & NORCET Study Tracker — Phase 4 (Branding + Study Boost)
-- Run this in Supabase SQL Editor AFTER 01, 02, 03 and 04 SQL files.
-- Phase 1-3 schema ko chheda nahi gaya — sirf 2 naye tables add ho rahe hain.
-- ============================================================================

-- ---------- 1. AI quiz attempts (score history) ----------
create table if not exists quiz_attempts (
  id text primary key,
  user_id text not null default 'me',
  subject_name text not null default 'General',
  topic text,
  total integer not null default 0 check (total >= 0),
  score integer not null default 0 check (score >= 0),
  provider text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists quiz_attempts_created_idx on quiz_attempts (created_at desc);

drop trigger if exists trg_quiz_attempts_touch on quiz_attempts;
create trigger trg_quiz_attempts_touch before update on quiz_attempts for each row execute function touch_updated_at();

alter table quiz_attempts enable row level security;

drop policy if exists single_user_access on quiz_attempts;
create policy single_user_access on quiz_attempts
  for all to anon, authenticated
  using (user_id = 'me')
  with check (user_id = 'me');

-- ---------- 2. Voice notes (audio as base64 data URL) ----------
create table if not exists voice_notes (
  id text primary key,
  user_id text not null default 'me',
  title text not null default 'Voice note',
  duration_sec integer not null default 0 check (duration_sec >= 0),
  audio_data text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists voice_notes_created_idx on voice_notes (created_at desc);

drop trigger if exists trg_voice_notes_touch on voice_notes;
create trigger trg_voice_notes_touch before update on voice_notes for each row execute function touch_updated_at();

alter table voice_notes enable row level security;

drop policy if exists single_user_access on voice_notes;
create policy single_user_access on voice_notes
  for all to anon, authenticated
  using (user_id = 'me')
  with check (user_id = 'me');

-- ---------- grants ----------
grant usage on schema public to anon, authenticated;
grant select, insert, update, delete on quiz_attempts to anon, authenticated;
grant select, insert, update, delete on voice_notes to anon, authenticated;
