-- ============================================================
-- Migration: notifications + volunteer-interest policies
-- Run this AFTER schema.sql has already been applied once.
-- Safe to run standalone — it only adds new policies, no table changes.
-- ============================================================

-- Let a signed-in user mark their own notifications as read.
create policy "notifications: recipient marks own as read" on notifications
  for update using (recipient_id = auth.uid());

-- Client-side inserts (the Edge Function path uses the service role key and
-- bypasses RLS, so this only matters if you ever insert from the app itself).
create policy "notifications: insert own as recipient" on notifications
  for insert with check (recipient_id = auth.uid());

-- Any signed-in user can update a volunteer_requests row to add/remove
-- themselves from interested_users. The app only ever touches that one
-- column from this path; for stricter guarantees, replace this with a
-- Postgres function that only mutates interested_users.
create policy "volunteer: users toggle their own interest" on volunteer_requests
  for update using (auth.uid() is not null);
