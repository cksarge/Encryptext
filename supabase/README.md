# Supabase

Run the migrations in order in the SQL editor, or with the CLI:

```bash
supabase link --project-ref <ref>
supabase db push
```

| File | Contents |
| --- | --- |
| `migrations/0001_schema.sql` | Tables, indexes, `REPLICA IDENTITY FULL` on `messages`, the `handle_new_user` profile trigger, the 2-participant cap trigger, the `last_activity_at` bump trigger, and the Realtime publication. |
| `migrations/0002_rls.sql` | `is_participant()` helper + Row Level Security policies for every table. Default-deny; all conversation state changes go through RPCs. |
| `migrations/0003_functions.sql` | `check_username`, `claim_prekey`, `mark_read`, `purge_message`, `request_conversation`, `respond_to_request`, `leave_conversation` + grants. |
| `migrations/0004_cron.sql` | Enables `pg_cron` and schedules the expiry sweep (every 10 seconds): deletes messages whose read timer (`expires_at`) has passed, and messages left unread for 24 hours. |

## Notes

- `0004` requires the `pg_cron` extension. Enable it under **Database →
  Extensions** first, or the `create extension` line will need superuser rights.
- The sweep deletes a message once its read timer (`expires_at`) has passed, or
  once it is 24 hours old, whichever happens first. Change the interval in
  `0004_cron.sql` if you want a different unread lifetime.
- Realtime: `0001` adds `messages`, `message_payloads` and `conversations` to the
  `supabase_realtime` publication. Make sure Realtime is enabled for the project.
- After changing the schema, regenerate `src/types/db.ts`:
  `supabase gen types typescript --linked > src/types/db.generated.ts`.
