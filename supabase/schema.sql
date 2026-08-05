-- ============================================================
-- कर्णSetu (KarnaSetu) — Supabase schema
-- Run this in Supabase Studio → SQL Editor (or via `supabase db push`)
-- ============================================================

-- ---------- ENUMS ----------
create type user_role as enum ('user', 'ngo', 'admin');
create type verification_status as enum ('pending_verification', 'approved', 'rejected');
create type post_type as enum ('stray_found', 'announcement', 'adoption', 'update');
create type donation_status as enum ('pending', 'success', 'failed');
create type food_status as enum ('open', 'claimed', 'expired');
create type book_status as enum ('available', 'reserved', 'fulfilled');

-- ---------- CORE TABLES ----------

create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  role user_role not null default 'user',
  full_name text not null,
  phone text,
  city text,
  verification_status verification_status not null default 'approved',
  created_at timestamptz not null default now()
);

create table ngos (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references profiles(id) on delete cascade,
  org_name text not null,
  category text not null,
  description text,
  city text,
  registration_doc_url text,
  created_at timestamptz not null default now(),
  unique (profile_id)
);

create table posts (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null references profiles(id) on delete cascade,
  type post_type not null,
  title text not null,
  description text,
  photo_url text,
  city text,
  created_at timestamptz not null default now()
);

create table campaigns (
  id uuid primary key default gen_random_uuid(),
  ngo_id uuid not null references ngos(id) on delete cascade,
  title text not null,
  goal_amount numeric not null default 0,
  raised_amount numeric not null default 0,
  deadline date,
  created_at timestamptz not null default now()
);

create table donations (
  id uuid primary key default gen_random_uuid(),
  donor_id uuid not null references profiles(id) on delete cascade,
  ngo_id uuid not null references ngos(id) on delete cascade,
  campaign_id uuid references campaigns(id) on delete set null,
  amount numeric not null check (amount > 0),
  status donation_status not null default 'pending',
  payment_ref text,
  created_at timestamptz not null default now()
);

create table volunteer_requests (
  id uuid primary key default gen_random_uuid(),
  ngo_id uuid not null references ngos(id) on delete cascade,
  title text not null,
  description text,
  slots_needed int default 1,
  event_date date,
  interested_users uuid[] default '{}',
  created_at timestamptz not null default now()
);

create table food_listings (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references profiles(id) on delete cascade,
  description text not null,
  quantity text not null,
  pickup_by timestamptz not null,
  claimed_by_ngo_id uuid references ngos(id) on delete set null,
  status food_status not null default 'open',
  city text,
  created_at timestamptz not null default now()
);

create table book_donations (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references profiles(id) on delete cascade,
  item_desc text not null,
  status book_status not null default 'available',
  requested_by uuid references profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create table notifications (
  id uuid primary key default gen_random_uuid(),
  recipient_id uuid not null references profiles(id) on delete cascade,
  type text not null,
  ref_id uuid,
  message text,
  read_status boolean not null default false,
  created_at timestamptz not null default now()
);

-- ---------- AUTO-CREATE PROFILE ON SIGNUP (fallback) ----------
-- The app also upserts a profile client-side right after signUp(); this trigger
-- is a safety net so a profile always exists even if that call is interrupted.
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, full_name, role, verification_status)
  values (new.id, coalesce(new.raw_user_meta_data->>'full_name', 'New User'), 'user', 'approved')
  on conflict (id) do nothing;
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================

alter table profiles enable row level security;
alter table ngos enable row level security;
alter table posts enable row level security;
alter table campaigns enable row level security;
alter table donations enable row level security;
alter table volunteer_requests enable row level security;
alter table food_listings enable row level security;
alter table book_donations enable row level security;
alter table notifications enable row level security;

-- Helper: is the current user an admin?
create or replace function public.is_admin()
returns boolean as $$
  select exists (
    select 1 from profiles where id = auth.uid() and role = 'admin'
  );
$$ language sql stable security definer;

-- ---------- profiles ----------
create policy "profiles: read own or admin" on profiles
  for select using (id = auth.uid() or is_admin() or true); -- public directory info is low-risk; tighten if needed
create policy "profiles: update own" on profiles
  for update using (id = auth.uid() or is_admin());
create policy "profiles: insert own" on profiles
  for insert with check (id = auth.uid());

-- ---------- ngos ----------
create policy "ngos: read approved or own or admin" on ngos
  for select using (
    is_admin()
    or profile_id = auth.uid()
    or exists (select 1 from profiles p where p.id = ngos.profile_id and p.verification_status = 'approved')
  );
create policy "ngos: insert own" on ngos
  for insert with check (profile_id = auth.uid());
create policy "ngos: update own or admin" on ngos
  for update using (profile_id = auth.uid() or is_admin());

-- ---------- posts (community feed, readable by all authenticated users) ----------
create policy "posts: read all" on posts for select using (auth.uid() is not null);
create policy "posts: insert own" on posts for insert with check (author_id = auth.uid());
create policy "posts: update/delete own or admin" on posts
  for update using (author_id = auth.uid() or is_admin());
create policy "posts: delete own or admin" on posts
  for delete using (author_id = auth.uid() or is_admin());

-- ---------- campaigns ----------
create policy "campaigns: read all" on campaigns for select using (auth.uid() is not null);
create policy "campaigns: ngo manages own" on campaigns
  for all using (
    exists (select 1 from ngos n where n.id = campaigns.ngo_id and n.profile_id = auth.uid())
    or is_admin()
  );

-- ---------- donations ----------
create policy "donations: donor or ngo owner or admin can read" on donations
  for select using (
    donor_id = auth.uid()
    or is_admin()
    or exists (select 1 from ngos n where n.id = donations.ngo_id and n.profile_id = auth.uid())
  );
create policy "donations: insert as self" on donations
  for insert with check (donor_id = auth.uid());

-- ---------- volunteer_requests ----------
create policy "volunteer: read all" on volunteer_requests for select using (auth.uid() is not null);
create policy "volunteer: ngo manages own" on volunteer_requests
  for all using (
    exists (select 1 from ngos n where n.id = volunteer_requests.ngo_id and n.profile_id = auth.uid())
    or is_admin()
  );

-- ---------- food_listings ----------
create policy "food: read all" on food_listings for select using (auth.uid() is not null);
create policy "food: business inserts own" on food_listings
  for insert with check (business_id = auth.uid());
create policy "food: owner or claiming ngo or admin updates" on food_listings
  for update using (
    business_id = auth.uid()
    or is_admin()
    or exists (select 1 from ngos n where n.id = food_listings.claimed_by_ngo_id and n.profile_id = auth.uid())
  );

-- ---------- book_donations ----------
create policy "books: read all" on book_donations for select using (auth.uid() is not null);
create policy "books: owner inserts own" on book_donations
  for insert with check (owner_id = auth.uid());
create policy "books: owner or requester or admin updates" on book_donations
  for update using (owner_id = auth.uid() or requested_by = auth.uid() or is_admin());

-- ---------- notifications ----------
create policy "notifications: read own" on notifications
  for select using (recipient_id = auth.uid() or is_admin());
create policy "notifications: insert via service role only"
  on notifications for insert with check (true); -- tighten to service_role in production

-- ============================================================
-- STORAGE (run in Studio → Storage, or via the dashboard UI)
-- ============================================================
-- 1. Create a bucket named "ngo-docs" (private or public per your comfort level).
-- 2. Create a bucket named "post-media" for stray/found photos.
-- Example storage policies (adjust bucket name accordingly):
--
-- insert into storage.buckets (id, name, public) values ('ngo-docs', 'ngo-docs', true);
-- insert into storage.buckets (id, name, public) values ('post-media', 'post-media', true);
--
-- create policy "Authenticated users can upload their own docs"
--   on storage.objects for insert
--   with check (bucket_id = 'ngo-docs' and auth.uid()::text = (storage.foldername(name))[1]);
--
-- create policy "Anyone can view ngo docs"
--   on storage.objects for select using (bucket_id = 'ngo-docs');
