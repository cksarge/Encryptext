-- Row Level Security. Default-deny everywhere; every read/write below is
-- explicitly scoped to the calling user (auth.uid()).

-- Security-definer helper so policies can ask "is the caller in this
-- conversation?" without recursing through conversation_participants' own RLS.
create function public.is_participant(conv uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from public.conversation_participants
    where conversation_id = conv and user_id = auth.uid()
  );
$$;

alter table public.profiles                  enable row level security;
alter table public.devices                   enable row level security;
alter table public.one_time_prekeys          enable row level security;
alter table public.conversations             enable row level security;
alter table public.conversation_participants enable row level security;
alter table public.messages                  enable row level security;
alter table public.message_payloads          enable row level security;
alter table public.push_subscriptions        enable row level security;

-- profiles ---------------------------------------------------------------------
create policy profiles_select on public.profiles
  for select to authenticated using (true);
create policy profiles_insert on public.profiles
  for insert to authenticated with check (id = auth.uid());
create policy profiles_update on public.profiles
  for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

-- devices --------------------------------------------------------------------
-- Public keys must be readable by anyone (the prekey directory); writes are
-- owner-only.
create policy devices_select on public.devices
  for select to authenticated using (true);
create policy devices_insert on public.devices
  for insert to authenticated with check (user_id = auth.uid());
create policy devices_update on public.devices
  for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy devices_delete on public.devices
  for delete to authenticated using (user_id = auth.uid());

-- one_time_prekeys ---------------------------------------------------------------
-- Reads are owner-only (used to count the remaining pool); claiming is done
-- through the security-definer RPC, not a direct DELETE.
create policy otk_select on public.one_time_prekeys
  for select to authenticated using (
    exists (select 1 from public.devices d
            where d.id = device_id and d.user_id = auth.uid())
  );
create policy otk_insert on public.one_time_prekeys
  for insert to authenticated with check (
    exists (select 1 from public.devices d
            where d.id = device_id and d.user_id = auth.uid())
  );
create policy otk_delete on public.one_time_prekeys
  for delete to authenticated using (
    exists (select 1 from public.devices d
            where d.id = device_id and d.user_id = auth.uid())
  );

-- conversations ------------------------------------------------------------------
-- Visible to both the requester and the invitee (so a pending request shows up
-- for the person who has to accept it). All state changes go through RPCs.
create policy conversations_select on public.conversations
  for select to authenticated using (
    created_by = auth.uid() or requested_user_id = auth.uid()
  );

-- conversation_participants ----------------------------------------------------
create policy cp_select on public.conversation_participants
  for select to authenticated using (public.is_participant(conversation_id));

-- messages ------------------------------------------------------------------
create policy messages_select on public.messages
  for select to authenticated using (public.is_participant(conversation_id));

create policy messages_insert on public.messages
  for insert to authenticated with check (
    sender_user_id = auth.uid()
    and public.is_participant(conversation_id)
    and exists (
      select 1 from public.conversations c
      where c.id = conversation_id and c.status = 'active'
    )
  );

create policy messages_delete on public.messages
  for delete to authenticated using (public.is_participant(conversation_id));

-- message_payloads ------------------------------------------------------------------
-- A client only ever pulls ciphertext addressed to one of its own devices.
create policy mp_select on public.message_payloads
  for select to authenticated using (
    exists (select 1 from public.devices d
            where d.id = recipient_device_id and d.user_id = auth.uid())
  );

-- Only the message's own sender may attach ciphertext to it.
create policy mp_insert on public.message_payloads
  for insert to authenticated with check (
    exists (select 1 from public.messages m
            where m.id = message_id and m.sender_user_id = auth.uid())
  );

create policy mp_delete on public.message_payloads
  for delete to authenticated using (
    exists (select 1 from public.messages m
            where m.id = message_id and public.is_participant(m.conversation_id))
  );

-- push_subscriptions ------------------------------------------------------------------
create policy push_all on public.push_subscriptions
  for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
