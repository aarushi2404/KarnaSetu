-- ============================================================
-- Migration 09: Geo-radius matching for stray/found-pet notifications
-- Run AFTER schema.sql.
--
-- Schema check performed first: no PostGIS extension, geography column, or
-- latitude/longitude column exists anywhere in the schema — matching today
-- is a plain `city` string comparison in
-- supabase/functions/notify-nearby-shelters/index.ts. expo-location and its
-- permissions are already wired into app.json but never actually called
-- anywhere in the app. This is the "genuinely missing field" case from
-- fallback Rule 4/8: the smallest change is two nullable coordinate columns
-- (posts, ngos) plus a database-side Haversine distance function, so
-- filtering happens in SQL rather than by fetching every NGO to the client.
-- City stays as a fallback for rows with no coordinates yet.
-- ============================================================

alter table posts add column if not exists latitude double precision;
alter table posts add column if not exists longitude double precision;
alter table ngos add column if not exists latitude double precision;
alter table ngos add column if not exists longitude double precision;

-- Haversine great-circle distance in kilometres between two lat/lng points.
create or replace function public.haversine_km(
  lat1 double precision, lng1 double precision,
  lat2 double precision, lng2 double precision
)
returns double precision as $$
declare
  r double precision := 6371; -- Earth radius in km
  d_lat double precision;
  d_lng double precision;
  a double precision;
begin
  if lat1 is null or lng1 is null or lat2 is null or lng2 is null then
    return null;
  end if;

  d_lat := radians(lat2 - lat1);
  d_lng := radians(lng2 - lng1);

  a := sin(d_lat / 2) * sin(d_lat / 2)
     + cos(radians(lat1)) * cos(radians(lat2)) * sin(d_lng / 2) * sin(d_lng / 2);

  return r * 2 * atan2(sqrt(a), sqrt(1 - a));
end;
$$ language plpgsql immutable;

-- Find approved animal-shelter NGOs within `p_radius_km` of a report's
-- coordinates, doing the distance filtering in the database rather than
-- pulling every NGO row to a client/edge function first (Rule 14: avoid
-- inefficient client-side fetch-everything).
--
-- p_radius_km is a parameter, not a hardcoded constant — see
-- supabase/functions/notify-nearby-shelters/index.ts for where it is
-- currently set to a default of 15 km; change DEFAULT_RADIUS_KM there, or
-- pass a different radius per-call, to reconfigure it.
create or replace function public.nearby_animal_shelters(
  p_lat double precision,
  p_lng double precision,
  p_radius_km double precision default 15
)
returns table (
  profile_id uuid,
  ngo_id uuid,
  org_name text,
  city text,
  distance_km double precision
) as $$
  select
    n.profile_id,
    n.id as ngo_id,
    n.org_name,
    n.city,
    public.haversine_km(p_lat, p_lng, n.latitude, n.longitude) as distance_km
  from ngos n
  join profiles p on p.id = n.profile_id
  where n.category ilike '%animal%'
    and p.verification_status = 'approved'
    and n.latitude is not null
    and n.longitude is not null
    and public.haversine_km(p_lat, p_lng, n.latitude, n.longitude) <= p_radius_km
  order by distance_km asc;
$$ language sql stable security definer;

grant execute on function public.nearby_animal_shelters(double precision, double precision, double precision) to authenticated, anon;
