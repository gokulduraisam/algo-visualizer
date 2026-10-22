-- Algo Visualizer: saved problems.
-- Run once in the Supabase dashboard: SQL Editor -> New query -> paste -> Run.
--
-- Privacy model:
--   * Signed-in users can read and change only their own rows (RLS below).
--   * Signed-out visitors get no table access at all (no grant to `anon`).
--   * A problem marked shared can be opened by anyone who has its exact id, through
--     get_shared_problem(), which returns that one row and never lists others.

create table public.problems (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  title text not null check (char_length(title) between 1 and 200),
  url text check (url is null or (url ~* '^https?://' and char_length(url) <= 2000)),
  difficulty text check (difficulty in ('Easy', 'Medium', 'Hard')),
  tags text[] not null default '{}' check (cardinality(tags) <= 20),
  notes text not null default '' check (char_length(notes) <= 20000),
  is_shared boolean not null default false,
  mode text not null check (mode in ('stdin', 'leetcode')),
  code text not null check (char_length(code) <= 100000),
  input text not null default '' check (char_length(input) <= 100000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index problems_user_updated on public.problems (user_id, updated_at desc);

-- New tables aren't exposed to the Data API automatically (Supabase change, 2026):
-- grant signed-in users access, and let RLS decide which rows they see.
alter table public.problems enable row level security;
grant select, insert, update, delete on table public.problems to authenticated;
-- Projects created before Supabase's 2026 change still give `anon` default table grants.
-- RLS already hides every row from signed-out visitors; this removes table access too.
revoke all on table public.problems from anon;

create policy "owners read their problems" on public.problems
  for select to authenticated
  using ((select auth.uid()) = user_id);

create policy "owners add problems" on public.problems
  for insert to authenticated
  with check ((select auth.uid()) = user_id);

create policy "owners edit their problems" on public.problems
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "owners delete their problems" on public.problems
  for delete to authenticated
  using ((select auth.uid()) = user_id);

-- Keep updated_at current on every edit.
create function public.touch_updated_at() returns trigger
  language plpgsql
  set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;
revoke execute on function public.touch_updated_at() from public, anon, authenticated;

create trigger problems_touch_updated_at
  before update on public.problems
  for each row execute function public.touch_updated_at();

-- Shared links (#p=<id>): returns one shared problem by its id, without its owner.
-- SECURITY DEFINER is deliberate: signed-out visitors have no table access, and this
-- function is the only way in. It can't list rows: it needs the exact (random) id,
-- and returns nothing unless the owner marked that problem as shared.
create function public.get_shared_problem(problem_id uuid)
returns table (
  title text, url text, difficulty text, tags text[], notes text,
  mode text, code text, input text
)
  language sql
  stable
  security definer
  set search_path = ''
as $$
  select p.title, p.url, p.difficulty, p.tags, p.notes, p.mode, p.code, p.input
  from public.problems p
  where p.id = problem_id and p.is_shared;
$$;
revoke execute on function public.get_shared_problem(uuid) from public;
grant execute on function public.get_shared_problem(uuid) to anon, authenticated;
