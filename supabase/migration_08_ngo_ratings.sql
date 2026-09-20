-- ============================================================
-- Migration 08: NGO ratings & reviews
-- Run AFTER schema.sql.
--
-- Schema check performed first: no reviews/ratings/feedback table exists
-- anywhere in schema.sql or migrations 02-05. Per fallback Rule 4/6, this
-- is the smallest new table needed. Eligibility to review is scoped to the
-- existing application's authorization model: because there is no
-- "completed interaction" record anywhere in the schema (no delivery/
-- fulfilment timestamp on donations, volunteer_requests, or food_listings),
-- eligibility is any authenticated, approved user — the same population
-- that can already donate/chat with an NGO on the ngos.tsx screen — with a
-- one-review-per-user-per-NGO constraint enforced in the database.
-- ============================================================

create table ngo_ratings (
  id uuid primary key default gen_random_uuid(),
  ngo_id uuid not null references ngos(id) on delete cascade,
  user_id uuid not null references profiles(id) on delete cascade,
  rating smallint not null check (rating between 1 and 5),
  review text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (ngo_id, user_id)
);

create index ngo_ratings_ngo_idx on ngo_ratings (ngo_id);

alter table ngo_ratings enable row level security;

create policy "ngo_ratings: read all" on ngo_ratings
  for select using (auth.uid() is not null);

create policy "ngo_ratings: user inserts own" on ngo_ratings
  for insert with check (user_id = auth.uid());

create policy "ngo_ratings: user updates own" on ngo_ratings
  for update using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "ngo_ratings: user or admin deletes" on ngo_ratings
  for delete using (user_id = auth.uid() or is_admin());

-- Aggregate view so screens don't need to fetch every row just to show an
-- average + count + star distribution.
create or replace view ngo_rating_summary
with (security_invoker = true) as
select
  ngo_id,
  count(*)::int as total_ratings,
  round(avg(rating)::numeric, 2) as average_rating,
  count(*) filter (where rating = 5)::int as star_5,
  count(*) filter (where rating = 4)::int as star_4,
  count(*) filter (where rating = 3)::int as star_3,
  count(*) filter (where rating = 2)::int as star_2,
  count(*) filter (where rating = 1)::int as star_1
from ngo_ratings
group by ngo_id;

-- Upsert a user's rating for an NGO (used instead of a raw insert so a user
-- revising their review updates the same row rather than being blocked by
-- the unique constraint).
create or replace function public.upsert_ngo_rating(
  p_ngo_id uuid,
  p_rating smallint,
  p_review text default null
)
returns setof ngo_ratings as $$
begin
  return query
    insert into ngo_ratings (ngo_id, user_id, rating, review)
    values (p_ngo_id, auth.uid(), p_rating, p_review)
    on conflict (ngo_id, user_id)
    do update set rating = excluded.rating, review = excluded.review, updated_at = now()
    returning *;
end;
$$ language plpgsql security invoker;

grant execute on function public.upsert_ngo_rating(uuid, smallint, text) to authenticated;
