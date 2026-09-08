-- Encryptext schema.
-- Everything the server stores is either a public key or ciphertext; there is
-- no column anywhere that could hold plaintext.

create extension if not exists "citext";
create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- profiles
-- ---------------------------------------------------------------------------
create table public.profiles (
  id           uuid primary key references auth.users (id) on delete cascade,
  username     citext not null unique,
  display_name text   not null,
  avatar_url   text,
  created_at   timestamptz not null default now(),
  constraint username_format   check (username ~ '^[a-z0-9_]{3,20}$'),
  constraint display_name_len  check (char_length(display_name) between 1 and 50)
);

-- Copy username / display_name chosen at sign-up into a profile row.
create function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, username, display_name)
  values (
    new.id,
    lower(coalesce(new.raw_user_meta_data ->> 'username',
                   'user_' || substr(new.id::text, 1, 8))),
    coalesce(new.raw_user_meta_data ->> 'display_name', 'New user')
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- devices  (the per-device "prekey server")
-- ---------------------------------------------------------------------------
create table public.devices (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null references auth.users (id) on delete cascade,
  identity_key      text not null,                 -- curve25519
  signing_key       text not null,                 -- ed25519
  signed_prekey     text not null,                 -- libolm fallback key
  signed_prekey_sig text not null,
  label             text not null default 'This device',
  created_at        timestamptz not null default now(),
  last_seen_at      timestamptz not null default now(),
  revoked_at        timestamptz,
  unique (user_id, identity_key)
);
create index devices_user_idx on public.devices (user_id) where revoked_at is null;

create table public.one_time_prekeys (
  id         uuid primary key default gen_random_uuid(),
  device_id  uuid not null references public.devices (id) on delete cascade,
  key_id     text not null,
  prekey     text not null,
  created_at timestamptz not null default now(),
  unique (device_id, key_id)
);
create index otk_device_idx on public.one_time_prekeys (device_id, created_at);

-- ---------------------------------------------------------------------------
-- conversations  (1:1, mutual-consent)
-- ---------------------------------------------------------------------------
create type public.conversation_status as enum ('pending', 'active', 'declined', 'ended');

create table public.conversations (
  id                uuid primary key default gen_random_uuid(),
  created_by        uuid not null references auth.users (id) on delete cascade,
  requested_user_id uuid not null references auth.users (id) on delete cascade,
  status            public.conversation_status not null default 'pending',
  created_at        timestamptz not null default now(),
  responded_at      timestamptz,
  ended_at          timestamptz,
  ended_by          uuid references auth.users (id),
  -- Cheap "last activity" clock for ordering the list. Messages are deleted
  -- aggressively, so this cannot be derived from max(messages.created_at).
  last_activity_at  timestamptz not null default now(),
  constraint no_self_conversation check (created_by <> requested_user_id)
);

-- At most one live thread per unordered pair of users.
create unique index conversations_unique_live_pair
  on public.conversations (
    least(created_by, requested_user_id),
    greatest(created_by, requested_user_id)
  )
  where status in ('pending', 'active');

create index conversations_requested_idx on public.conversations (requested_user_id);
create index conversations_created_by_idx on public.conversations (created_by);
create index conversations_activity_idx on public.conversations (last_activity_at desc);

create table public.conversation_participants (
  conversation_id uuid not null references public.conversations (id) on delete cascade,
  user_id         uuid not null references auth.users (id) on delete cascade,
  added_at        timestamptz not null default now(),
  primary key (conversation_id, user_id)
);
create index cp_user_idx on public.conversation_participants (user_id);

-- Hard cap: no groups, ever.
create function public.enforce_two_participants()
returns trigger
language plpgsql
as $$
begin
  if (select count(*) from public.conversation_participants
      where conversation_id = new.conversation_id) >= 2 then
    raise exception 'a conversation can have at most 2 participants';
  end if;
  return new;
end;
$$;

create trigger conversation_participants_cap
  before insert on public.conversation_participants
  for each row execute function public.enforce_two_participants();

-- ---------------------------------------------------------------------------
-- messages + per-recipient-device ciphertext
-- ---------------------------------------------------------------------------
create table public.messages (
  id               uuid primary key default gen_random_uuid(),
  conversation_id  uuid not null references public.conversations (id) on delete cascade,
  sender_user_id   uuid not null references auth.users (id) on delete cascade,
  sender_device_id uuid not null references public.devices (id) on delete cascade,
  created_at       timestamptz not null default now(),
  delivered_at     timestamptz,
  first_read_at    timestamptz,           -- null until the recipient views it
  expires_at       timestamptz            -- null until first read; then + 30s
);
create index messages_conversation_idx on public.messages (conversation_id, created_at);
create index messages_expiry_idx on public.messages (expires_at) where expires_at is not null;
-- Used by the once-a-minute sweep to drop messages left unread for 24h.
create index messages_created_at_idx on public.messages (created_at);

-- Realtime DELETE events must carry the whole old row so clients can route them.
alter table public.messages replica identity full;

create table public.message_payloads (
  id                  uuid primary key default gen_random_uuid(),
  message_id          uuid not null references public.messages (id) on delete cascade,
  recipient_device_id uuid not null references public.devices (id) on delete cascade,
  olm_type            smallint not null check (olm_type in (0, 1)),
  ciphertext          text not null,
  unique (message_id, recipient_device_id)
);
create index mp_message_idx on public.message_payloads (message_id);
create index mp_recipient_idx on public.message_payloads (recipient_device_id);

-- Keep conversations.last_activity_at current as messages arrive.
create function public.bump_conversation_activity()
returns trigger
language plpgsql
as $$
begin
  update public.conversations
     set last_activity_at = now()
   where id = new.conversation_id;
  return new;
end;
$$;

create trigger messages_bump_activity
  after insert on public.messages
  for each row execute function public.bump_conversation_activity();

-- ---------------------------------------------------------------------------
-- push_subscriptions  (only used once background Web Push is enabled)
-- ---------------------------------------------------------------------------
create table public.push_subscriptions (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users (id) on delete cascade,
  endpoint   text not null unique,
  p256dh     text not null,
  auth       text not null,
  created_at timestamptz not null default now()
);
create index push_user_idx on public.push_subscriptions (user_id);

-- ---------------------------------------------------------------------------
-- Realtime publication
-- ---------------------------------------------------------------------------
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table public.messages;
    alter publication supabase_realtime add table public.message_payloads;
    alter publication supabase_realtime add table public.conversations;
  end if;
exception
  when duplicate_object then null;
end;
$$;
