# Encryptext

End-to-end encrypted 1:1 messaging on Supabase. Messages are encrypted on the
sender's device with a key that never leaves it, and the server copy is deleted
30 seconds after the recipient reads it.

- **Crypto:** libolm (Olm) — X3DH-style prekey handshake + Double Ratchet, the
  same construction Signal uses. Private keys live only in the browser's
  IndexedDB. Supabase stores ciphertext and public keys, nothing else.
- **Self-destruct:** a message is deleted when (a) the recipient reads it and 30s
  pass, (b) the sender deletes it, or (c) it has gone unread for 24 hours —
  whichever is first.
- **Consent:** conversations are 1:1 and mutual — one person requests, the other
  accepts. Either can leave at any time, which wipes the thread for both.
- **Auth:** Supabase email + password, a 6-digit email OTP to confirm the
  address, and an optional device-local passkey for passwordless re-login.

See [`src/pages/Security.tsx`](src/pages/Security.tsx) for the threat model in
plain language, and the planning doc for the full design rationale.

## Stack

Vite + React + TypeScript · Tailwind CSS v4 · TanStack Query · `@matrix-org/olm`
· `@supabase/supabase-js`. Deploys as a static site — all crypto is client-side.

## Local setup

Requires Node 24 (`.nvmrc`). With nvm: `nvm use`.

```bash
npm install
cp .env.example .env.local   # fill in from Supabase → Project Settings → API
npm run dev
```

| Script | What it does |
| --- | --- |
| `npm run dev` | Vite dev server |
| `npm run build` | Type-check + production build to `dist/` |
| `npm run typecheck` | `tsc -b` only |
| `npm test` | Vitest (crypto core round-trip, ratchet, tamper, fallback key…) |
| `npm run lint` | oxlint |

## Supabase setup

1. Create a project. In the SQL editor, run the files in
   [`supabase/migrations`](supabase/migrations) **in order** (`0001` → `0004`).
   `0004` needs the `pg_cron` extension (Database → Extensions → enable
   `pg_cron`), and runs the once-a-minute expiry sweep.
2. **Auth → Providers → Email:** turn *Confirm email* on.
   *Testing without SMTP:* turn *Confirm email* **off** instead, and set
   `VITE_SKIP_EMAIL_CONFIRM=true` in `.env.local` — sign-up then goes straight to
   the app with no email sent. Reverse both before launch.
3. **Auth → Email Templates → Confirm signup:** replace the body with the 6-digit
   code form, e.g. `Your Encryptext code is {{ .Token }}`. (The app calls
   `verifyOtp({ type: 'signup' })`, not a magic link.)
4. **Auth → URL Configuration:** add your dev and prod origins to the redirect
   allow-list (used only by the password-reset flow).
5. The built-in email sender is rate-limited to a few messages/hour — fine for
   development. Before real use, set a transactional SMTP provider under
   **Auth → SMTP settings** (Resend, SES, SendGrid, Postmark). No app changes.
6. Regenerate typed DB types after any schema change:
   `npx supabase gen types typescript --project-id <ref> > src/types/db.generated.ts`
   and point `src/lib/supabase.ts` at it (the hand-written `src/types/db.ts` is
   the stopgap).

### Verifying it works

- Sign in as two users in two browsers; exchange messages in real time.
- In the SQL editor, inspect `messages` and `message_payloads` — only ciphertext,
  no plaintext, no preview.
- Read a message as the recipient; watch the row disappear from both tables
  within ~30s. Close the tab right after reading and confirm the 1-minute
  `pg_cron` sweep still removes it.
- Send a message the recipient never opens; confirm it survives the 1-minute
  sweep but is gone once it is 24 hours old.
- Try to insert a third `conversation_participants` row via SQL — the trigger
  rejects it (no groups).

## Legal

`/terms` and `/privacy` hold draft Terms of Service and a Privacy Policy. They
are developer-drafted starting points, **not legal advice** — have them reviewed
by counsel and fill in the `[bracketed]` placeholders (contact email, governing
law) before launch. Sign-up requires ticking two boxes to agree to both.

## Not in v1

Background Web Push (needs a Service Worker + VAPID + the `push_subscriptions`
table + one Edge Function), passphrase-encrypted key backup, and group chats.
Notifications today are foreground-only, driven by the existing Realtime
subscriptions, and never contain message text.

Server-side verification of the Cloudflare Turnstile token (in a Supabase Auth
hook or Edge Function) still needs wiring up; the widget and client gating are in
place and activate when `VITE_TURNSTILE_SITE_KEY` is set.

---

© 2026 Carter Kasarjian. All rights reserved.
