-- ============================================================
-- Migration 05: CSR company portal
-- ============================================================

-- Add 'company' as a new profile role.
alter type user_role add value 'company';

-- A company logs its CSR engagements against NGOs manually for now
-- (no separate payment/volunteer-hour integration exists yet — this
-- mirrors how volunteer_requests/food_listings are tracked today).
create table csr_engagements (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references profiles(id) on delete cascade,
  ngo_id uuid not null references ngos(id) on delete cascade,
  engagement_type text not null check (engagement_type in ('donation', 'volunteer_hours', 'food_drive', 'other')),
  amount numeric,             -- for 'donation'
  hours numeric,               -- for 'volunteer_hours'
  description text,
  engagement_date date not null default current_date,
  created_at timestamptz not null default now()
);

alter table csr_engagements enable row level security;

create policy "csr: company reads own" on csr_engagements
  for select using (
    company_id = auth.uid()
    or is_admin()
    or exists (select 1 from ngos n where n.id = csr_engagements.ngo_id and n.profile_id = auth.uid())
  );

create policy "csr: company inserts own" on csr_engagements
  for insert with check (company_id = auth.uid());

create policy "csr: company updates own" on csr_engagements
  for update using (company_id = auth.uid() or is_admin());