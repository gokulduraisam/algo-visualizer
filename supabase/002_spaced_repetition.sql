-- Algo Visualizer: spaced repetition (run after 001_problems.sql).
-- SQL Editor -> New query -> paste -> Run.

-- When each problem is next due, and how its schedule is growing (see viewer/srs.js).
alter table public.problems
  add column due_at timestamptz not null default now() + interval '1 day',
  add column interval_days real not null default 0 check (interval_days between 0 and 3650),
  add column ease real not null default 2.5 check (ease between 1.3 and 5),
  add column reps integer not null default 0 check (reps >= 0),
  add column lapses integer not null default 0 check (lapses >= 0),
  add column last_reviewed_at timestamptz;

create index problems_user_due on public.problems (user_id, due_at);

-- Problems saved before this change are due right away, so you can start reviewing today.
update public.problems set due_at = now();

-- One row per review: powers the streak, the activity grid and the rank.
create table public.reviews (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  problem_id uuid not null references public.problems (id) on delete cascade,
  rating text not null check (rating in ('again', 'hard', 'good', 'easy')),
  reviewed_at timestamptz not null default now()
);

create index reviews_user_time on public.reviews (user_id, reviewed_at desc);

alter table public.reviews enable row level security;
grant select, insert on table public.reviews to authenticated;
revoke all on table public.reviews from anon;

create policy "owners read their reviews" on public.reviews
  for select to authenticated
  using ((select auth.uid()) = user_id);

-- You can only log reviews of your own problems. No update/delete: history stays as it happened.
create policy "owners log reviews of their problems" on public.reviews
  for insert to authenticated
  with check (
    (select auth.uid()) = user_id
    and exists (select 1 from public.problems p where p.id = problem_id and p.user_id = (select auth.uid()))
  );

-- Log a review and store the new schedule in one step, so they can't disagree.
-- SECURITY INVOKER: runs as the signed-in user, so the RLS policies above still apply.
create function public.record_review(
  p_problem_id uuid,
  p_rating text,
  p_due_at timestamptz,
  p_interval_days real,
  p_ease real,
  p_reps integer,
  p_lapses integer
)
returns setof public.problems
  language plpgsql
  security invoker
  set search_path = ''
as $$
begin
  insert into public.reviews (problem_id, rating) values (p_problem_id, p_rating);
  return query
    update public.problems
       set due_at = p_due_at, interval_days = p_interval_days, ease = p_ease,
           reps = p_reps, lapses = p_lapses, last_reviewed_at = now()
     where id = p_problem_id
    returning *;
end;
$$;

revoke execute on function public.record_review(uuid, text, timestamptz, real, real, integer, integer) from public, anon;
grant execute on function public.record_review(uuid, text, timestamptz, real, real, integer, integer) to authenticated;
