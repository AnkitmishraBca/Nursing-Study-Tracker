-- ============================================================
--  Phase 5 — Advanced Security (Login Protection)
--  File: sql/06_phase5.sql
--  Run this in Supabase SQL Editor (or psql) AFTER 05_*.sql
--  Safe to re-run: uses IF NOT EXISTS / ON CONFLICT
-- ============================================================

create table if not exists public.app_security (
  id            integer      primary key default 1,
  current_token text,
  password_hash text,
  updated_at    timestamptz  not null default now(),
  -- single-row table: sirf ek hi user (tu) hai
  constraint app_security_single_row check (id = 1)
);

comment on table  public.app_security is 'Phase 5: single-row security state (dynamic login token + bcrypt password hash)';
comment on column public.app_security.current_token is 'Latest dynamic login token. Naya token banate hi purana overwrite ho jaata hai -> purana invalid.';
comment on column public.app_security.password_hash is 'bcryptjs hash (cost 11). Plain password kabhi store nahi hota.';
comment on column public.app_security.updated_at   is 'Har change par auto-update. Session epoch bhi isi se banta hai, isliye token/password badalne par purane sessions bhi mar jaate hain.';

-- ---------- auto-bump updated_at on every UPDATE ----------
create or replace function public.touch_app_security()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists trg_touch_app_security on public.app_security;
create trigger trg_touch_app_security
  before update on public.app_security
  for each row execute function public.touch_app_security();

-- ---------- seed the single row ----------
insert into public.app_security (id, current_token, password_hash)
values (1, null, null)
on conflict (id) do nothing;

-- ---------- RLS ----------
-- App server side se DATABASE_URL (postgres role) se connect karta hai,
-- isliye RLS on rakhna safe hai: anon/public key se koi is table ko chhoo nahi sakta.
alter table public.app_security enable row level security;

-- koi policy nahi = sirf service_role / postgres access kar sakta hai. Ye intended hai.

-- ---------- verify ----------
-- select id, (current_token is not null) as token_set,
--        (password_hash is not null) as password_set, updated_at
-- from public.app_security;
