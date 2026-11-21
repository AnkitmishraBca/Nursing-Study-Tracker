-- ============================================================================
-- BSc Nursing & NORCET Study Tracker — Phase 2 (AI Short Notes) extra table
-- Run this in Supabase SQL Editor AFTER 01_schema.sql and 02_seed.sql.
-- Only ONE new table is required for Phase 2: ai_notes (saved AI library).
-- ============================================================================

create table if not exists ai_notes (
  id text primary key,
  user_id text not null default 'me',
  title text not null default 'AI Short Notes',
  source_text text not null default '',
  mode text not null default 'short-notes',
  language text not null default 'en',
  provider text,
  model text,
  content text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------- indexes ----------
create index if not exists ai_notes_created_idx on ai_notes (created_at desc);

-- ---------- updated_at trigger ----------
drop trigger if exists trg_ai_notes_touch on ai_notes;
create trigger trg_ai_notes_touch before update on ai_notes for each row execute function touch_updated_at();

-- ---------- Row Level Security (same single-user policy as Phase 1) ----------
alter table ai_notes enable row level security;

drop policy if exists single_user_access on ai_notes;
create policy single_user_access on ai_notes
  for all to anon, authenticated
  using (user_id = 'me')
  with check (user_id = 'me');

grant usage on schema public to anon, authenticated;
grant select, insert, update, delete on ai_notes to anon, authenticated;
