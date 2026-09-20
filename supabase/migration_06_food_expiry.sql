-- ============================================================
-- Migration 06: Auto-expire food listings (server-side)
-- Run AFTER schema.sql.
--
-- The food donation board must not rely only on frontend filtering to
-- decide whether a listing is expired (a listing could otherwise be
-- claimed after its pickup window has passed). This migration adds a
-- SECURITY DEFINER function that flips any 'open' listing whose
-- pickup_by has passed to 'expired'. The app calls this via RPC right
-- before it loads the board, so the status column in the database is
-- always the source of truth, not just a display computation.
-- ============================================================

create or replace function public.expire_food_listings()
returns void as $$
begin
  update food_listings
  set status = 'expired'
  where status = 'open'
    and pickup_by < now();
end;
$$ language plpgsql security definer;

-- Any signed-in user may trigger the sweep (it only ever tightens data,
-- never exposes anything), so a plain grant is enough — RLS on
-- food_listings itself still governs what each caller can subsequently see.
grant execute on function public.expire_food_listings() to authenticated;

-- Belt-and-braces: the atomic claim update in the app already guards with
-- `.eq("status", "open")`, but also guard it here so a claim can never
-- succeed against a listing whose pickup time has already passed, even if
-- the sweep above hasn't run yet in this request.
create or replace function public.claim_food_listing(p_listing_id uuid, p_ngo_id uuid)
returns setof food_listings as $$
begin
  return query
    update food_listings
    set status = 'claimed', claimed_by_ngo_id = p_ngo_id
    where id = p_listing_id
      and status = 'open'
      and pickup_by >= now()
      and exists (
        select 1 from ngos n
        where n.id = p_ngo_id and n.profile_id = auth.uid()
      )
    returning *;
end;
$$ language plpgsql security definer;

grant execute on function public.claim_food_listing(uuid, uuid) to authenticated;
