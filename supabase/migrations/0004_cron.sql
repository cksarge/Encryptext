-- The message expiry sweep.
--
-- Runs entirely inside Postgres (no Edge Function, no compute-hours) against
-- indexed columns, so it stays free-tier-safe even at a short interval — each
-- run is a sub-millisecond DELETE on a table that is almost always tiny.
--
-- A message is deleted here when either:
--   * it has been read and its 30-second timer has elapsed
--     (expires_at is set by mark_read; the recipient's tab normally deletes it
--      first — this is the backstop for a closed tab), or
--   * it has gone unread for 24 hours (delivered or not).
--
-- The sender's manual "delete" button removes messages immediately via the
-- purge_message RPC and does not depend on this job.

create extension if not exists pg_cron;

-- Safe to re-run: cron.schedule upserts by name, and this clears older names.
select cron.unschedule(jobid)
from cron.job
where jobname in ('encryptext-expire-read-messages');

-- Every 10 seconds (pg_cron >= 1.5 sub-minute syntax). Worst-case lifetime of an
-- already-read message if every client tab is closed: ~30s + one interval.
select cron.schedule(
  'encryptext-expire-messages',
  '10 seconds',
  $$ delete from public.messages
       where (expires_at is not null and expires_at < now())
          or created_at < now() - interval '24 hours'; $$
);

-- To change the unread lifetime or the sweep interval, just re-run cron.schedule
-- with the same job name and new values.
