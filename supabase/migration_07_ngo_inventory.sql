-- ============================================================
-- Migration 07: NGO resource / inventory tracker
-- Run AFTER schema.sql.
--
-- Schema check performed first: neither schema.sql nor migrations 02-05
-- contain any table representing an NGO's on-hand stock (food_listings is
-- a marketplace of *offers* between businesses and NGOs, not an NGO's own
-- inventory; donations/campaigns are money, not goods). Per fallback Rule
-- 4/6, this is the smallest new table needed — one row per resource type
-- per NGO, with an append-only transaction log so quantity changes are
-- auditable rather than being blind overwrites.
-- ============================================================

create type ngo_resource_category as enum ('food', 'medical', 'clothing', 'other');

create table ngo_resources (
  id uuid primary key default gen_random_uuid(),
  ngo_id uuid not null references ngos(id) on delete cascade,
  category ngo_resource_category not null,
  name text not null,
  unit text not null default 'units',
  quantity numeric not null default 0 check (quantity >= 0),
  low_stock_threshold numeric not null default 0,
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (ngo_id, category, name)
);

create table ngo_resource_transactions (
  id uuid primary key default gen_random_uuid(),
  resource_id uuid not null references ngo_resources(id) on delete cascade,
  ngo_id uuid not null references ngos(id) on delete cascade,
  change_amount numeric not null,
  reason text,
  created_by uuid references profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create index ngo_resource_transactions_resource_idx
  on ngo_resource_transactions (resource_id, created_at desc);

alter table ngo_resources enable row level security;
alter table ngo_resource_transactions enable row level security;

create policy "ngo_resources: owner ngo or admin reads" on ngo_resources
  for select using (
    is_admin()
    or exists (select 1 from ngos n where n.id = ngo_resources.ngo_id and n.profile_id = auth.uid())
  );

create policy "ngo_resources: owner ngo manages" on ngo_resources
  for all using (
    exists (select 1 from ngos n where n.id = ngo_resources.ngo_id and n.profile_id = auth.uid())
    or is_admin()
  )
  with check (
    exists (select 1 from ngos n where n.id = ngo_resources.ngo_id and n.profile_id = auth.uid())
    or is_admin()
  );

create policy "ngo_resource_transactions: owner ngo or admin reads" on ngo_resource_transactions
  for select using (
    is_admin()
    or exists (select 1 from ngos n where n.id = ngo_resource_transactions.ngo_id and n.profile_id = auth.uid())
  );

create policy "ngo_resource_transactions: owner ngo inserts" on ngo_resource_transactions
  for insert with check (
    exists (select 1 from ngos n where n.id = ngo_resource_transactions.ngo_id and n.profile_id = auth.uid())
  );

-- Adjust a resource's quantity and log the change atomically. Using an RPC
-- (rather than a bare client-side UPDATE) means the new quantity is always
-- computed from the current row server-side, so two concurrent adjustments
-- can't clobber each other, and it enforces the >= 0 check consistently.
create or replace function public.adjust_ngo_resource(
  p_resource_id uuid,
  p_change numeric,
  p_reason text default null
)
returns setof ngo_resources as $$
declare
  v_ngo_id uuid;
begin
  select ngo_id into v_ngo_id from ngo_resources where id = p_resource_id;

  if v_ngo_id is null then
    raise exception 'Resource not found';
  end if;

  if not exists (select 1 from ngos n where n.id = v_ngo_id and n.profile_id = auth.uid()) then
    raise exception 'Not authorized to adjust this resource';
  end if;

  update ngo_resources
  set quantity = quantity + p_change,
      updated_at = now()
  where id = p_resource_id;

  insert into ngo_resource_transactions (resource_id, ngo_id, change_amount, reason, created_by)
  values (p_resource_id, v_ngo_id, p_change, p_reason, auth.uid());

  return query select * from ngo_resources where id = p_resource_id;
end;
$$ language plpgsql security definer;

grant execute on function public.adjust_ngo_resource(uuid, numeric, text) to authenticated;
