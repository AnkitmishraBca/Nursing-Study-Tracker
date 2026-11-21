-- ============================================================================
-- BSc Nursing & NORCET Study Tracker — Phase 1 schema (Supabase / PostgreSQL)
-- Run this FIRST in Supabase SQL Editor. Then run 02_seed.sql.
-- Single-user personal app: every row belongs to user_id = 'me'.
-- ============================================================================

create extension if not exists pgcrypto;

create table if not exists user_settings (
  user_id text primary key default 'me',
  exam_name text not null default 'NORCET',
  exam_date date,
  study_time text not null default '19:00',
  alarm_enabled boolean not null default true,
  alarm_days jsonb not null default '[0,1,2,3,4,5,6]'::jsonb,
  snooze_minutes integer not null default 5,
  focus_mode boolean not null default true,
  pomodoro_min integer not null default 25,
  short_break_min integer not null default 5,
  long_break_min integer not null default 15,
  streak_freezes integer not null default 2,
  frozen_dates jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now()
);

create table if not exists user_stats (
  user_id text primary key default 'me',
  xp integer not null default 0,
  streak integer not null default 0,
  longest_streak integer not null default 0,
  total_minutes integer not null default 0,
  last_study_date date,
  updated_at timestamptz not null default now()
);

create table if not exists subjects (
  user_id text not null default 'me',
  id text primary key,
  code text not null,
  name text not null,
  "group" text not null check ("group" in ('backlog', 'current', 'norcet')),
  semester integer not null default 0,
  icon text not null default '📘',
  color text not null default '#60a5fa',
  constraint subjects_user_code_uq unique (user_id, code)
);

create table if not exists topics (
  user_id text not null default 'me',
  id text primary key,
  subject_id text not null references subjects (id) on delete cascade,
  title text not null,
  level1 text not null default 'todo' check (level1 in ('todo', 'in_progress', 'done')),
  level2 text not null default 'todo' check (level2 in ('todo', 'in_progress', 'done')),
  level3 text not null default 'todo' check (level3 in ('todo', 'in_progress', 'done')),
  revision_count integer not null default 0,
  last_studied_at timestamptz,
  constraint topics_user_subject_title_uq unique (user_id, subject_id, title)
);

create table if not exists study_sessions (
  id text primary key,
  user_id text not null default 'me',
  subject_id text references subjects (id) on delete set null,
  topic_id text references topics (id) on delete set null,
  minutes integer not null check (minutes > 0),
  mode text not null default 'study',
  ended_at timestamptz not null default now()
);

create table if not exists waste_sessions (
  id text primary key,
  user_id text not null default 'me',
  category text not null,
  minutes integer not null check (minutes > 0),
  ended_at timestamptz not null default now()
);

create table if not exists calendar_marks (
  user_id text not null default 'me',
  date date not null,
  status text not null check (status in ('full', 'partial', 'not')),
  note text,
  updated_at timestamptz not null default now(),
  primary key (user_id, date)
);

create table if not exists alarms (
  id text primary key,
  user_id text not null default 'me',
  scheduled_at timestamptz not null,
  fired_at timestamptz,
  snoozed_to timestamptz,
  status text not null default 'scheduled' check (status in ('scheduled', 'fired', 'snoozed', 'dismissed')),
  note text
);

create table if not exists notes (
  id text primary key,
  user_id text not null default 'me',
  title text not null,
  body text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists health_logs (
  id text primary key,
  user_id text not null default 'me',
  date date not null,
  water integer not null default 0,
  diet text check (diet in ('good', 'okay', 'bad')),
  sleep_hours double precision not null default 0,
  mood text,
  updated_at timestamptz not null default now(),
  constraint health_user_date_uq unique (user_id, date)
);

create table if not exists mock_tests (
  id text primary key,
  user_id text not null default 'me',
  title text not null,
  score double precision,
  total integer not null default 100,
  taken_at timestamptz not null default now()
);

-- ---------- indexes ----------
create index if not exists topics_subject_idx on topics (subject_id);
create index if not exists study_sessions_ended_idx on study_sessions (ended_at desc);
create index if not exists study_sessions_subject_idx on study_sessions (subject_id);
create index if not exists waste_sessions_ended_idx on waste_sessions (ended_at desc);
create index if not exists alarms_scheduled_idx on alarms (scheduled_at desc);
create index if not exists notes_updated_idx on notes (updated_at desc);
create index if not exists mock_tests_taken_idx on mock_tests (taken_at desc);

-- ---------- updated_at trigger ----------
create or replace function touch_updated_at() returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_settings_touch on user_settings;
create trigger trg_settings_touch before update on user_settings for each row execute function touch_updated_at();
drop trigger if exists trg_stats_touch on user_stats;
create trigger trg_stats_touch before update on user_stats for each row execute function touch_updated_at();
drop trigger if exists trg_marks_touch on calendar_marks;
create trigger trg_marks_touch before update on calendar_marks for each row execute function touch_updated_at();
drop trigger if exists trg_notes_touch on notes;
create trigger trg_notes_touch before update on notes for each row execute function touch_updated_at();
drop trigger if exists trg_health_touch on health_logs;
create trigger trg_health_touch before update on health_logs for each row execute function touch_updated_at();

-- ---------- Row Level Security ----------
-- This is a single-user app: anon key is allowed for one fixed owner ('me').
-- For a multi-user version, replace 'me' with auth.uid()::text and add Supabase Auth.
alter table user_settings  enable row level security;
alter table user_stats     enable row level security;
alter table subjects       enable row level security;
alter table topics         enable row level security;
alter table study_sessions enable row level security;
alter table waste_sessions enable row level security;
alter table calendar_marks enable row level security;
alter table alarms         enable row level security;
alter table notes          enable row level security;
alter table health_logs    enable row level security;
alter table mock_tests     enable row level security;

do $$
declare t text;
begin
  foreach t in array array[
    'user_settings','user_stats','subjects','topics','study_sessions',
    'waste_sessions','calendar_marks','alarms','notes','health_logs','mock_tests'
  ]
  loop
    execute format('drop policy if exists single_user_access on %I', t);
    execute format(
      'create policy single_user_access on %I for all to anon, authenticated using (user_id = ''me'') with check (user_id = ''me'')',
      t
    );
  end loop;
end $$;

grant usage on schema public to anon, authenticated;
grant select, insert, update, delete on all tables in schema public to anon, authenticated;
