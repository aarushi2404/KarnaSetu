-- ============================================================
-- Migration 03: Admin audit trail + account suspend/flag
-- Run AFTER schema.sql and migration_02 have been applied.
-- ============================================================

alter table profiles
  add column account_status text not null default 'active'
  check (account_status in ('active', 'suspended', 'flagged'));

create table audit_logs (
  id uuid primary key default gen_random_uuid(),
  admin_id uuid not null references profiles(id),
  action text not null,
  target_type text not null,
  target_id uuid not null,
  reason text,
  created_at timestamptz not null default now()
);

create index audit_logs_created_at_idx on audit_logs (created_at desc);

alter table audit_logs enable row level security;

create policy "audit_logs: admin read" on audit_logs
  for select using (is_admin());

create policy "audit_logs: admin insert" on audit_logs
  for insert with check (is_admin() and admin_id = auth.uid());