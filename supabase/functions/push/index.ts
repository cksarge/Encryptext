// Encryptext — send a Web Push when a message is inserted.
//
// Deploy:
//   supabase functions deploy push --no-verify-jwt
//
// Secrets (supabase secrets set ...):
//   VAPID_PUBLIC_KEY   — from `npx web-push generate-vapid-keys`
//   VAPID_PRIVATE_KEY  — from the same command (keep secret)
//   VAPID_SUBJECT      — e.g. mailto:you@example.com
//   PUSH_HOOK_SECRET   — a random string; also set as the webhook's Authorization header
// (SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are injected automatically.)
//
// Trigger: Dashboard -> Database -> Webhooks -> Create
//   Table: messages   Events: Insert   Type: Supabase Edge Functions -> push
//   HTTP header:  Authorization: Bearer <PUSH_HOOK_SECRET>
//
// The payload never contains message text — the function only ever sees
// ciphertext. It sends the sender's @handle and a generic line.

import webpush from 'npm:web-push@3.6.7'
import { createClient } from 'npm:@supabase/supabase-js@2'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const VAPID_PUBLIC = Deno.env.get('VAPID_PUBLIC_KEY')!
const VAPID_PRIVATE = Deno.env.get('VAPID_PRIVATE_KEY')!
const VAPID_SUBJECT = Deno.env.get('VAPID_SUBJECT') ?? 'mailto:admin@example.com'
const HOOK_SECRET = Deno.env.get('PUSH_HOOK_SECRET')!

webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC, VAPID_PRIVATE)
const admin = createClient(SUPABASE_URL, SERVICE_ROLE)

interface WebhookBody {
  type?: string
  table?: string
  record?: {
    conversation_id?: string
    sender_user_id?: string
  }
}

Deno.serve(async (req) => {
  if (req.headers.get('authorization') !== `Bearer ${HOOK_SECRET}`) {
    return new Response('unauthorized', { status: 401 })
  }

  let body: WebhookBody
  try {
    body = await req.json()
  } catch {
    return new Response('bad request', { status: 400 })
  }

  const record = body.record
  if (body.type !== 'INSERT' || body.table !== 'messages' || !record) {
    return new Response('ignored', { status: 200 })
  }

  const conversationId = record.conversation_id
  const senderId = record.sender_user_id
  if (!conversationId || !senderId) {
    return new Response('ignored', { status: 200 })
  }

  const { data: parts } = await admin
    .from('conversation_participants')
    .select('user_id')
    .eq('conversation_id', conversationId)

  const recipientIds = (parts ?? [])
    .map((p: { user_id: string }) => p.user_id)
    .filter((id: string) => id !== senderId)
  if (recipientIds.length === 0) {
    return new Response('no recipients', { status: 200 })
  }

  const { data: sender } = await admin
    .from('profiles')
    .select('username')
    .eq('id', senderId)
    .maybeSingle()
  const handle = sender?.username ? `@${sender.username}` : 'someone'

  const { data: subs } = await admin
    .from('push_subscriptions')
    .select('id, endpoint, p256dh, auth')
    .in('user_id', recipientIds)

  const payload = JSON.stringify({
    title: 'Encryptext',
    body: `New message from ${handle}`,
    url: '/app',
    tag: `c:${conversationId}`,
  })

  await Promise.all(
    (subs ?? []).map(
      async (s: {
        id: string
        endpoint: string
        p256dh: string
        auth: string
      }) => {
        try {
          await webpush.sendNotification(
            {
              endpoint: s.endpoint,
              keys: { p256dh: s.p256dh, auth: s.auth },
            },
            payload,
          )
        } catch (err) {
          const code = (err as { statusCode?: number }).statusCode
          if (code === 404 || code === 410) {
            await admin.from('push_subscriptions').delete().eq('id', s.id)
          } else {
            console.error('web push failed', code, (err as Error).message)
          }
        }
      },
    ),
  )

  return new Response('ok', { status: 200 })
})
