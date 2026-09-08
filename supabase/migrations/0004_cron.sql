-- The message expiry sweep.
--
-- Runs entirely inside Postgres (no Edge Function, no compute-hours) against
-- indexed columns, once a minute, so it stays free-tier-safe.
--
-- A message is deleted here when either:
--   * it has been read and its 30-second timer has elapsed
--     (expires_at is set by mark_read and is normally cleared client-side first;
--      this is the backstop for a recipient who closed the tab), or
--   * it has gone unread for 24 hours (delivered or not).
--
-- The sender's manual "delete" button removes messages immediately via the
-- purge_message RPC and does not depend on this job.

create extension if not exists pg_cron;

select cron.schedule(
  'encryptext-expire-messages',
  '* * * * *',
  $$ delete from public.messages
       where (expires_at is not null and expires_at < now())
          or created_at < now() - interval '24 hours'; $$
);

-- To change the unread lifetime, unschedule and reschedule with a different
-- interval:
--   select cron.unschedule('encryptext-expire-messages');
--   select cron.schedule('encryptext-expire-messages', '* * * * *',
--     $$ delete from public.messages
--          where (expires_at is not null and expires_at < now())
--             or created_at < now() - interval '7 days'; $$);
