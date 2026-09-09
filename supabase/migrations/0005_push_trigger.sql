-- Calls the `push` Edge Function whenever a message is inserted, so recipients
-- with a saved push subscription get a background notification.
--
-- This is the same thing the dashboard's "Database Webhooks" UI does, written by
-- hand so you don't need that UI. Only run this once the `push` function is
-- deployed and its secrets are set.
--
-- BEFORE RUNNING: replace the two <PLACEHOLDERS> below.
--   * <PROJECT_URL>      your project URL, e.g. https://xdcjchzfovjrqdkddcbp.supabase.co
--   * <PUSH_HOOK_SECRET> the exact same random string you set as the
--                        PUSH_HOOK_SECRET secret on the function

create extension if not exists pg_net;

create or replace function public.notify_push_on_message()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- A push dispatch failure must never roll back the message insert.
  begin
    perform net.http_post(
      url     := '<PROJECT_URL>/functions/v1/push',
      headers := jsonb_build_object(
        'Content-Type',  'application/json',
        'Authorization', 'Bearer <PUSH_HOOK_SECRET>'
      ),
      body    := jsonb_build_object(
        'type',   'INSERT',
        'table',  'messages',
        'record', to_jsonb(new)
      )
    );
  exception
    when others then
      raise warning 'push dispatch failed: %', sqlerrm;
  end;
  return new;
end;
$$;

drop trigger if exists push_on_message on public.messages;
create trigger push_on_message
  after insert on public.messages
  for each row execute function public.notify_push_on_message();
