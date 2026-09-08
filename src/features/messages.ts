import { useCallback, useEffect, useRef, useState } from 'react'
import {
  currentDevice,
  encryptForParticipants,
  forgetCachedMessage,
  getCachedMessage,
  receiveMessage,
  rememberSent,
} from '@/crypto'
import { useAuth } from '@/auth/AuthProvider'
import { useInterval } from '@/lib/hooks'
import { sleep } from '@/lib/utils'
import { supabase } from '@/lib/supabase'
import type { MessagePayloadRow, MessageRow, OlmMessageType } from '@/types/db'

/** Seconds a message stays visible after it has been read (while on screen). */
const VIEW_WINDOW_MS = 30_000

export interface ThreadMessage {
  id: string
  senderUserId: string
  mine: boolean
  createdAt: string
  text: string | null
  status: 'ok' | 'pending' | 'unavailable'
  firstReadAt: string | null
  expiresAt: string | null
}

function toBase(row: MessageRow, myUserId: string): ThreadMessage {
  return {
    id: row.id,
    senderUserId: row.sender_user_id,
    mine: row.sender_user_id === myUserId,
    createdAt: row.created_at,
    text: null,
    status: 'pending',
    firstReadAt: row.first_read_at,
    expiresAt: row.expires_at,
  }
}

function tabVisible(): boolean {
  return typeof document === 'undefined' || document.visibilityState === 'visible'
}

async function fetchMyPayload(
  messageId: string,
  deviceId: string,
): Promise<{ type: OlmMessageType; body: string } | null> {
  for (let attempt = 0; attempt < 6; attempt += 1) {
    const { data } = await supabase
      .from('message_payloads')
      .select('olm_type, ciphertext')
      .eq('message_id', messageId)
      .eq('recipient_device_id', deviceId)
      .maybeSingle()
    if (data) {
      return { type: data.olm_type as OlmMessageType, body: data.ciphertext }
    }
    await sleep(250 * (attempt + 1))
  }
  return null
}

export function useThread(conversationId: string, peerUserId: string) {
  const { user } = useAuth()
  const myUserId = user!.id
  const [messages, setMessages] = useState<ThreadMessage[]>([])
  const [ready, setReady] = useState(false)
  const [viewing, setViewing] = useState(tabVisible)
  /** Per-message seconds left in the on-screen view window. */
  const [readCountdowns, setReadCountdowns] = useState<Record<string, number>>({})

  const purgeTimers = useRef(new Map<string, ReturnType<typeof setTimeout>>())
  /** Per-message accumulated *visible* time since the message was read. */
  const readClocks = useRef(new Map<string, { accumMs: number; lastMs: number }>())

  useEffect(() => {
    const onChange = () => setViewing(tabVisible())
    document.addEventListener('visibilitychange', onChange)
    return () => document.removeEventListener('visibilitychange', onChange)
  }, [])

  const upsert = useCallback((next: ThreadMessage) => {
    setMessages((prev) => {
      const idx = prev.findIndex((m) => m.id === next.id)
      const merged = idx >= 0 ? { ...prev[idx], ...next } : next
      const list =
        idx >= 0 ? prev.map((m, i) => (i === idx ? merged : m)) : [...prev, merged]
      return list.sort((a, b) => a.createdAt.localeCompare(b.createdAt))
    })
  }, [])

  const remove = useCallback((id: string) => {
    setMessages((prev) => prev.filter((m) => m.id !== id))
    setReadCountdowns((c) => {
      if (!(id in c)) return c
      const next = { ...c }
      delete next[id]
      return next
    })
    readClocks.current.delete(id)
    void forgetCachedMessage(id)
    const timer = purgeTimers.current.get(id)
    if (timer) {
      clearTimeout(timer)
      purgeTimers.current.delete(id)
    }
  }, [])

  /** Coarse server-cap backstop (also the only client purge the sender does). */
  const schedulePurge = useCallback((id: string, expiresAt: string) => {
    if (purgeTimers.current.has(id)) return
    const delay = Math.max(0, new Date(expiresAt).getTime() - Date.now())
    const timer = setTimeout(() => {
      purgeTimers.current.delete(id)
      void supabase.rpc('purge_message', { msg: id })
    }, delay)
    purgeTimers.current.set(id, timer)
  }, [])

  /**
   * Begin the 30-seconds-of-viewing countdown for a message the recipient has
   * read. Capped by the server's own `expires_at` so the ring never promises
   * more time than the backstop allows.
   */
  const startReadClock = useCallback(
    (id: string, expiresAtIso: string | null) => {
      if (readClocks.current.has(id)) return
      const serverLeftMs = expiresAtIso
        ? Math.max(0, new Date(expiresAtIso).getTime() - Date.now())
        : VIEW_WINDOW_MS
      const startLeftMs = Math.min(VIEW_WINDOW_MS, serverLeftMs)
      readClocks.current.set(id, {
        accumMs: VIEW_WINDOW_MS - startLeftMs,
        lastMs: Date.now(),
      })
      setReadCountdowns((c) => ({ ...c, [id]: Math.ceil(startLeftMs / 1000) }))
    },
    [],
  )

  // The visible-time ticker: only accrues while the tab is actually shown.
  useInterval(() => {
    if (readClocks.current.size === 0) return
    const now = Date.now()
    const visible = tabVisible()
    const updates: Record<string, number> = {}
    const expired: string[] = []

    for (const [id, clock] of readClocks.current) {
      const delta = now - clock.lastMs
      clock.lastMs = now
      if (visible) clock.accumMs += delta
      const leftMs = VIEW_WINDOW_MS - clock.accumMs
      if (leftMs <= 0) expired.push(id)
      else updates[id] = Math.ceil(leftMs / 1000)
    }

    if (Object.keys(updates).length) {
      setReadCountdowns((c) => ({ ...c, ...updates }))
    }
    for (const id of expired) {
      readClocks.current.delete(id)
      void supabase.rpc('purge_message', { msg: id })
      remove(id)
    }
  }, 250)

  const hydrate = useCallback(
    async (row: MessageRow) => {
      const device = currentDevice()
      if (!device) return
      const base = toBase(row, myUserId)

      try {
        if (base.mine) {
          const cached = await getCachedMessage(row.id)
          upsert({
            ...base,
            text: cached?.text ?? null,
            status: cached ? 'ok' : 'unavailable',
          })
        } else {
          const payload = await fetchMyPayload(row.id, device.deviceId)
          if (!payload) {
            upsert({ ...base, status: 'unavailable' })
            return
          }
          const text = await receiveMessage({
            messageId: row.id,
            conversationId,
            senderUserId: row.sender_user_id,
            senderDeviceId: row.sender_device_id,
            createdAt: row.created_at,
            payload,
          })
          upsert({ ...base, text, status: 'ok' })
        }
      } catch (err) {
        console.error('decrypt failed', row.id, err)
        upsert({ ...base, status: 'unavailable' })
      }

      // A received message that was already read in a previous session: restart
      // the on-screen countdown (best effort — visible time isn't persisted).
      if (!base.mine && base.firstReadAt) startReadClock(row.id, base.expiresAt)
      if (base.expiresAt) schedulePurge(row.id, base.expiresAt)
    },
    [conversationId, myUserId, schedulePurge, startReadClock, upsert],
  )

  // Initial load ------------------------------------------------------------
  useEffect(() => {
    let active = true
    setReady(false)
    setMessages([])
    setReadCountdowns({})
    readClocks.current.clear()

    ;(async () => {
      const { data } = await supabase
        .from('messages')
        .select('*')
        .eq('conversation_id', conversationId)
        .order('created_at', { ascending: true })
      if (!active) return
      const rows = (data ?? []) as MessageRow[]
      await Promise.all(rows.map((row) => hydrate(row)))
      if (active) setReady(true)
    })()

    return () => {
      active = false
    }
  }, [conversationId, hydrate])

  // Realtime --------------------------------------------------------------
  useEffect(() => {
    const channel = supabase
      .channel(`thread-${conversationId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `conversation_id=eq.${conversationId}`,
        },
        (payload) => void hydrate(payload.new as MessageRow),
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'messages',
          filter: `conversation_id=eq.${conversationId}`,
        },
        (payload) => {
          const row = payload.new as MessageRow
          setMessages((prev) =>
            prev.map((m) =>
              m.id === row.id
                ? {
                    ...m,
                    firstReadAt: row.first_read_at,
                    expiresAt: row.expires_at,
                  }
                : m,
            ),
          )
          if (row.expires_at) schedulePurge(row.id, row.expires_at)
        },
      )
      .on(
        'postgres_changes',
        {
          event: 'DELETE',
          schema: 'public',
          table: 'messages',
          filter: `conversation_id=eq.${conversationId}`,
        },
        (payload) => remove((payload.old as { id: string }).id),
      )
      .subscribe()

    return () => {
      void supabase.removeChannel(channel)
    }
  }, [conversationId, hydrate, remove, schedulePurge])

  // Read receipts: only fire while the tab is actually being viewed ---------
  useEffect(() => {
    if (!viewing) return
    const unread = messages.filter(
      (m) => !m.mine && !m.firstReadAt && m.status !== 'pending',
    )
    if (unread.length === 0) return
    let cancelled = false
    ;(async () => {
      for (const m of unread) {
        const { data } = await supabase.rpc('mark_read', { msg: m.id })
        if (cancelled) return
        const expiresAt = (data as string | null) ?? null
        setMessages((prev) =>
          prev.map((x) =>
            x.id === m.id
              ? { ...x, firstReadAt: new Date().toISOString(), expiresAt }
              : x,
          ),
        )
        startReadClock(m.id, expiresAt)
        if (expiresAt) schedulePurge(m.id, expiresAt)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [messages, viewing, startReadClock, schedulePurge])

  // Cleanup all timers on unmount --------------------------------------
  useEffect(() => {
    const timers = purgeTimers.current
    const clocks = readClocks.current
    return () => {
      for (const t of timers.values()) clearTimeout(t)
      timers.clear()
      clocks.clear()
    }
  }, [])

  const send = useCallback(
    async (text: string) => {
      const body = text.trim()
      if (!body) return
      const device = currentDevice()
      if (!device) throw new Error('This device is not ready to send yet.')

      const payloads = await encryptForParticipants([myUserId, peerUserId], body)

      const { data: message, error } = await supabase
        .from('messages')
        .insert({
          conversation_id: conversationId,
          sender_user_id: myUserId,
          sender_device_id: device.deviceId,
        })
        .select('*')
        .single()
      if (error || !message) throw error ?? new Error('send failed')
      const row = message as MessageRow

      if (payloads.length) {
        const { error: pErr } = await supabase.from('message_payloads').insert(
          payloads.map((p) => ({
            message_id: row.id,
            recipient_device_id: p.recipient_device_id,
            olm_type: p.olm_type,
            ciphertext: p.ciphertext,
          })) as MessagePayloadRow[],
        )
        if (pErr) throw pErr
      }

      await rememberSent({
        messageId: row.id,
        conversationId,
        senderUserId: myUserId,
        text: body,
        createdAt: row.created_at,
      })
      upsert({
        id: row.id,
        senderUserId: myUserId,
        mine: true,
        createdAt: row.created_at,
        text: body,
        status: 'ok',
        firstReadAt: null,
        expiresAt: null,
      })
    },
    [conversationId, myUserId, peerUserId, upsert],
  )

  return { messages, ready, send, readCountdowns, viewing }
}
