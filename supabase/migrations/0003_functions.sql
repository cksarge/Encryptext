-- RPCs. Each runs security-definer so it can enforce its own rule set; every
-- one re-checks auth.uid() against the row it touches.

-- check_username ------------------------------------------------------------------
create or replace function public.check_username(name text)
returns boolean
language sql
security definer
set search_path = public
as $$
  select lower(name) ~ '^[a-z0-9_]{3,20}$'
     and not exists (select 1 from public.profiles where username = lower(name));
$$;

-- claim_prekey ------------------------------------------------------------------
-- Atomically hand out (and delete) one one-time key for a target device.
-- Returns zero rows when the pool is empty; the caller then uses the fallback.
create or replace function public.claim_prekey(target_device uuid)
returns table (key_id text, prekey text)
language sql
security definer
set search_path = public
as $$
  delete from public.one_time_prekeys
  where id = (
    select id from public.one_time_prekeys
    where device_id = target_device
    order by created_at
    for update skip locked
    limit 1
  )
  returning one_time_prekeys.key_id, one_time_prekeys.prekey;
$$;

-- mark_read ------------------------------------------------------------------
-- The only thing that arms deletion. Recipient-only, one-shot.
--
-- `expires_at` here is a generous hard backstop: the recipient's client deletes
-- the message after 30 seconds of it actually being *on screen* (paused while
-- the tab is hidden). This 2-minute cap only matters if that client dies or
-- vanishes right after opening the message.
create or replace function public.mark_read(msg uuid)
returns timestamptz
language plpgsql
security definer
set search_path = public
as $$
declare
  new_expiry timestamptz;
begin
  update public.messages m
     set first_read_at = now(),
         expires_at    = now() + interval '2 minutes',
         delivered_at  = coalesce(m.delivered_at, now())
   where m.id = msg
     and m.first_read_at is null
     and m.sender_user_id <> auth.uid()
     and public.is_participant(m.conversation_id)
  returning m.expires_at into new_expiry;

  return new_expiry;
end;
$$;

-- purge_message ------------------------------------------------------------------
-- Recipient's 30s timer, and the sender's manual delete button.
create or replace function public.purge_message(msg uuid)
returns void
language sql
security definer
set search_path = public
as $$
  delete from public.messages m
  where m.id = msg and public.is_participant(m.conversation_id);
$$;

-- request_conversation ------------------------------------------------------------------
create or replace function public.request_conversation(other_username text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  other uuid;
  conv  uuid;
begin
  select id into other from public.profiles where username = lower(other_username);
  if other is null then
    raise exception 'no user named %', other_username using errcode = 'no_data_found';
  end if;
  if other = auth.uid() then
    raise exception 'you cannot start a conversation with yourself';
  end if;

  select id into conv
  from public.conversations
  where status in ('pending', 'active')
    and least(created_by, requested_user_id)    = least(auth.uid(), other)
    and greatest(created_by, requested_user_id) = greatest(auth.uid(), other);
  if conv is not null then
    return conv;
  end if;

  insert into public.conversations (created_by, requested_user_id)
  values (auth.uid(), other)
  returning id into conv;
  return conv;
end;
$$;

-- respond_to_request ------------------------------------------------------------------
create or replace function public.respond_to_request(conversation uuid, accept boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  c public.conversations;
begin
  select * into c from public.conversations where id = conversation for update;
  if c.id is null then
    raise exception 'conversation not found';
  end if;
  if c.requested_user_id <> auth.uid() then
    raise exception 'only the invited user can respond';
  end if;
  if c.status <> 'pending' then
    raise exception 'this request has already been answered';
  end if;

  if accept then
    update public.conversations
       set status = 'active', responded_at = now(), last_activity_at = now()
     where id = conversation;
    insert into public.conversation_participants (conversation_id, user_id)
    values (conversation, c.created_by), (conversation, c.requested_user_id)
    on conflict do nothing;
  else
    update public.conversations
       set status = 'declined', responded_at = now()
     where id = conversation;
  end if;
end;
$$;

-- leave_conversation ------------------------------------------------------------------
-- Either participant, any time. Ends the thread and wipes every message in it.
create or replace function public.leave_conversation(conversation uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not (
    public.is_participant(conversation)
    or exists (select 1 from public.conversations c
               where c.id = conversation
                 and (c.created_by = auth.uid() or c.requested_user_id = auth.uid()))
  ) then
    raise exception 'not your conversation';
  end if;

  update public.conversations
     set status = 'ended', ended_by = auth.uid(), ended_at = now()
   where id = conversation and status in ('pending', 'active');

  delete from public.messages where conversation_id = conversation;
end;
$$;

-- Expose to the browser (PostgREST) for logged-in users only.
grant execute on function public.check_username(text)             to authenticated;
grant execute on function public.claim_prekey(uuid)               to authenticated;
grant execute on function public.mark_read(uuid)                  to authenticated;
grant execute on function public.purge_message(uuid)             to authenticated;
grant execute on function public.request_conversation(text)       to authenticated;
grant execute on function public.respond_to_request(uuid, boolean) to authenticated;
grant execute on function public.leave_conversation(uuid)         to authenticated;

revoke execute on function public.claim_prekey(uuid)   from anon;
revoke execute on function public.mark_read(uuid)      from anon;
revoke execute on function public.purge_message(uuid) from anon;
