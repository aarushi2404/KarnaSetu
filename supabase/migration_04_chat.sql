-- ============================================================
-- Migration 04: In-app chat between User and NGO
-- ============================================================

create table conversations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  ngo_id uuid not null references ngos(id) on delete cascade,
  created_at timestamptz not null default now(),
  last_message_at timestamptz not null default now(),
  unique (user_id, ngo_id)
);

create table messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references conversations(id) on delete cascade,
  sender_id uuid not null references profiles(id) on delete cascade,
  body text not null,
  created_at timestamptz not null default now(),
  read_at timestamptz
);

create index messages_conversation_id_idx on messages (conversation_id, created_at);

alter table conversations enable row level security;
alter table messages enable row level security;

create policy "conversations: participants or admin read" on conversations
  for select using (
    user_id = auth.uid()
    or is_admin()
    or exists (select 1 from ngos n where n.id = conversations.ngo_id and n.profile_id = auth.uid())
  );

create policy "conversations: user starts own" on conversations
  for insert with check (user_id = auth.uid());

create policy "messages: participants or admin read" on messages
  for select using (
    is_admin()
    or exists (
      select 1 from conversations c
      where c.id = messages.conversation_id
        and (c.user_id = auth.uid()
             or exists (select 1 from ngos n where n.id = c.ngo_id and n.profile_id = auth.uid()))
    )
  );

create policy "messages: participants send" on messages
  for insert with check (
    sender_id = auth.uid()
    and exists (
      select 1 from conversations c
      where c.id = messages.conversation_id
        and (c.user_id = auth.uid()
             or exists (select 1 from ngos n where n.id = c.ngo_id and n.profile_id = auth.uid()))
    )
  );

create policy "messages: recipient marks read" on messages
  for update using (
    exists (
      select 1 from conversations c
      where c.id = messages.conversation_id
        and (c.user_id = auth.uid()
             or exists (select 1 from ngos n where n.id = c.ngo_id and n.profile_id = auth.uid()))
    )
  );

-- Keep conversations.last_message_at current so inboxes sort correctly.
create or replace function public.touch_conversation()
returns trigger as $$
begin
  update conversations set last_message_at = new.created_at where id = new.conversation_id;
  return new;
end;
$$ language plpgsql security definer;

create trigger on_message_inserted
  after insert on messages
  for each row execute procedure public.touch_conversation();