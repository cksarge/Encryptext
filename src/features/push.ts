/**
 * Background Web Push (this device). Requires a service worker + a VAPID key +
 * the `push` Edge Function. Works with zero extra setup on desktop Chrome, Edge,
 * Firefox, Brave, and Safari 16+. iOS Safari tabs return false here (they only
 * expose PushManager inside an installed PWA), which is intentional.
 */

import { supabase } from '@/lib/supabase'

const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY?.trim()
const LOCAL_FLAG = 'encryptext:push'

export function pushSupported(): boolean {
  return (
    typeof navigator !== 'undefined' &&
    'serviceWorker' in navigator &&
    typeof window !== 'undefined' &&
    'PushManager' in window &&
    'Notification' in window &&
    Boolean(VAPID_PUBLIC_KEY)
  )
}

function urlBase64ToUint8Array(base64: string): Uint8Array<ArrayBuffer> {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4)
  const normalized = (base64 + padding).replace(/-/g, '+').replace(/_/g, '/')
  const raw = atob(normalized)
  const out = new Uint8Array(raw.length)
  for (let i = 0; i < raw.length; i += 1) out[i] = raw.charCodeAt(i)
  return out
}

async function getRegistration(): Promise<ServiceWorkerRegistration> {
  const existing = await navigator.serviceWorker.getRegistration('/')
  if (existing) return existing
  return navigator.serviceWorker.register('/sw.js', { scope: '/' })
}

function toRow(sub: PushSubscription) {
  const json = sub.toJSON()
  return {
    endpoint: sub.endpoint,
    p256dh: json.keys?.p256dh ?? '',
    auth: json.keys?.auth ?? '',
  }
}

/** True when this browser currently holds a push subscription. */
export async function pushEnabled(): Promise<boolean> {
  if (!pushSupported()) return false
  try {
    const reg = await navigator.serviceWorker.getRegistration('/')
    const sub = await reg?.pushManager.getSubscription()
    return Boolean(sub)
  } catch {
    return false
  }
}

export async function enablePush(): Promise<void> {
  if (!pushSupported()) {
    throw new Error('This browser can’t do background notifications.')
  }
  if (Notification.permission !== 'granted') {
    const result = await Notification.requestPermission()
    if (result !== 'granted') {
      throw new Error('Allow notifications to turn this on.')
    }
  }

  const reg = await getRegistration()
  await navigator.serviceWorker.ready

  let sub = await reg.pushManager.getSubscription()
  if (!sub) {
    sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY as string),
    })
  }

  const {
    data: { session },
  } = await supabase.auth.getSession()
  if (!session) throw new Error('Sign in first.')

  const { error } = await supabase
    .from('push_subscriptions')
    .upsert(
      { user_id: session.user.id, ...toRow(sub) },
      { onConflict: 'endpoint' },
    )
  if (error) throw error

  try {
    localStorage.setItem(LOCAL_FLAG, 'on')
  } catch {
    /* ignore */
  }
}

export async function disablePush(): Promise<void> {
  try {
    localStorage.removeItem(LOCAL_FLAG)
  } catch {
    /* ignore */
  }
  if (!pushSupported()) return
  try {
    const reg = await navigator.serviceWorker.getRegistration('/')
    const sub = await reg?.pushManager.getSubscription()
    if (sub) {
      await supabase
        .from('push_subscriptions')
        .delete()
        .eq('endpoint', sub.endpoint)
      await sub.unsubscribe()
    }
  } catch {
    /* best effort */
  }
}

/**
 * On app load: if push was enabled on this device, re-assert the (possibly
 * rotated) subscription with the server. Never prompts.
 */
export async function syncPush(): Promise<void> {
  let wanted = false
  try {
    wanted = localStorage.getItem(LOCAL_FLAG) === 'on'
  } catch {
    return
  }
  if (!wanted || !pushSupported() || Notification.permission !== 'granted') return
  try {
    await enablePush()
  } catch {
    /* leave it; the user can re-toggle in Settings */
  }
}
