/**
 * v1 notifications: foreground only, driven by the Realtime subscriptions the
 * app already has. Content is deliberately minimal — a handle and a generic
 * line, never message text (the client only holds ciphertext until it decrypts
 * locally anyway). Background Web Push is a later addition and needs a Service
 * Worker + the push Edge Function.
 */

const STORAGE_KEY = 'encryptext:notify'

export function notificationsSupported(): boolean {
  return typeof window !== 'undefined' && 'Notification' in window
}

export function notificationsEnabled(): boolean {
  if (!notificationsSupported()) return false
  if (Notification.permission !== 'granted') return false
  try {
    return localStorage.getItem(STORAGE_KEY) !== 'off'
  } catch {
    return true
  }
}

export function setNotificationsPreference(on: boolean): void {
  try {
    localStorage.setItem(STORAGE_KEY, on ? 'on' : 'off')
  } catch {
    /* ignore */
  }
}

/** Has the user been asked at least once? Used to show the one-time prompt. */
export function notificationsPrompted(): boolean {
  if (!notificationsSupported()) return true
  return Notification.permission !== 'default'
}

export async function requestNotifications(): Promise<boolean> {
  if (!notificationsSupported()) return false
  const result = await Notification.requestPermission()
  const granted = result === 'granted'
  setNotificationsPreference(granted)
  return granted
}

export function notify(title: string, body: string): void {
  if (!notificationsEnabled()) return
  if (document.visibilityState === 'visible' && document.hasFocus()) return
  try {
    const n = new Notification(title, { body, tag: 'encryptext' })
    n.onclick = () => {
      window.focus()
      n.close()
    }
  } catch {
    /* some browsers require a SW registration for notifications; ignore */
  }
}
