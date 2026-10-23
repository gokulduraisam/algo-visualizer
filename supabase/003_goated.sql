-- Algo Visualizer: solve/recall times and your Codeforces handle (run after 002).
-- SQL Editor -> New query -> paste -> Run.

-- How long the first solve took (from the visualizer's timer), and how long each recall took.
alter table public.problems
  add column solve_seconds integer check (solve_seconds between 0 and 86400);
alter table public.reviews
  add column recall_seconds integer check (recall_seconds between 0 and 86400);

-- record_review now also stores the recall time. Same rules: SECURITY INVOKER, so RLS applies.
drop function public.record_review(uuid, text, timestamptz, real, real, integer, integer);
create function public.record_review(
  p_problem_id uuid,
  p_rating text,
  p_due_at timestamptz,
  p_interval_days real,
  p_ease real,
  p_reps integer,
  p_lapses integer,
  p_recall_seconds integer default null
)
returns setof public.problems
  language plpgsql
  security invoker
  set search_path = ''
as $$
begin
  insert into public.reviews (problem_id, rating, recall_seconds) values (p_problem_id, p_rating, p_recall_seconds);
  return query
    update public.problems
       set due_at = p_due_at, interval_days = p_interval_days, ease = p_ease,
           reps = p_reps, lapses = p_lapses, last_reviewed_at = now()
     where id = p_problem_id
    returning *;
end;
$$;
revoke execute on function public.record_review(uuid, text, timestamptz, real, real, integer, integer, integer) from public, anon;
grant execute on function public.record_review(uuid, text, timestamptz, real, real, integer, integer, integer) to authenticated;

-- One row per user: settings that follow you across devices.
create table public.profiles (
  user_id uuid primary key default auth.uid() references auth.users (id) on delete cascade,
  codeforces_handle text check (codeforces_handle ~ '^[A-Za-z0-9_.-]{3,24}$'),
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;
grant select, insert, update on table public.profiles to authenticated;
revoke all on table public.profiles from anon;

create policy "owners read their profile" on public.profiles
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "owners create their profile" on public.profiles
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "owners edit their profile" on public.profiles
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
