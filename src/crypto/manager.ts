/**
 * The stateful bridge between the pure crypto core, this browser's IndexedDB
 * store, and Supabase (which plays "prekey server" + ciphertext relay).
 *
 * The app only ever imports from here; `core.ts` stays pure and testable.
 */

import { supabase } from '@/lib/supabase'
import { bytesToBase64 } from '@/lib/utils'
import type { DeviceRow } from '@/types/db'
import {
  createAccount,
  decrypt,
  encrypt,
  replenishKeys,
  safetyNumber,
  type MessagePayload,
  type PrekeyBundle,
} from './core'
import {
  cacheMessage,
  getCachedMessage,
  getSessions,
  loadIdentity,
  putSessions,
  saveIdentity,
  wipeAll,
  type StoredIdentity,
} from './store'

const OTK_LOW_WATER = 10
const OTK_REFILL = 50
const MAX_SESSIONS_PER_PEER = 3

let identity: StoredIdentity | null = null
let initPromise: Promise<StoredIdentity> | null = null
const deviceCache = new Map<string, DeviceRow>()

function randomPickleKey(): string {
  const bytes = new Uint8Array(32)
  crypto.getRandomValues(bytes)
  return bytesToBase64(bytes)
}

function defaultDeviceLabel(): string {
  const ua = navigator.userAgent
  const os = /Mac/.test(ua)
    ? 'macOS'
    : /Windows/.test(ua)
      ? 'Windows'
      : /Android/.test(ua)
        ? 'Android'
        : /iPhone|iPad/.test(ua)
          ? 'iOS'
          : /Linux/.test(ua)
            ? 'Linux'
            : 'device'
  const browser = /Firefox/.test(ua)
    ? 'Firefox'
    : /Edg\//.test(ua)
      ? 'Edge'
      : /Chrome/.test(ua)
        ? 'Chrome'
        : /Safari/.test(ua)
          ? 'Safari'
          : 'browser'
  return `${browser} on ${os}`
}

async function countOwnPrekeys(deviceId: string): Promise<number> {
  const { count } = await supabase
    .from('one_time_prekeys')
    .select('id', { count: 'exact', head: true })
    .eq('device_id', deviceId)
  return count ?? 0
}

async function maybeReplenishPrekeys(): Promise<void> {
  if (!identity) return
  if ((await countOwnPrekeys(identity.deviceId)) >= OTK_LOW_WATER) return

  const res = await replenishKeys(
    identity.accountPickle,
    identity.pickleKey,
    OTK_REFILL,
  )
  identity = { ...identity, accountPickle: res.accountPickle }
  await saveIdentity(identity)

  if (res.oneTimeKeys.length) {
    await supabase.from('one_time_prekeys').insert(
      res.oneTimeKeys.map((k) => ({
        device_id: identity!.deviceId,
        key_id: k.keyId,
        prekey: k.key,
      })),
    )
  }
  if (res.fallbackKey) {
    await supabase
      .from('devices')
      .update({
        signed_prekey: res.fallbackKey.key,
        signed_prekey_sig: res.fallbackKey.sig,
      })
      .eq('id', identity.deviceId)
  }
}

async function enrollNewDevice(userId: string): Promise<StoredIdentity> {
  const pickleKey = randomPickleKey()
  const { accountPickle, keys } = await createAccount(pickleKey, OTK_REFILL)

  const { data: device, error } = await supabase
    .from('devices')
    .insert({
      user_id: userId,
      identity_key: keys.identityKey,
      signing_key: keys.signingKey,
      signed_prekey: keys.fallbackKey,
      signed_prekey_sig: keys.fallbackKeySig,
      label: defaultDeviceLabel(),
    })
    .select('*')
    .single()
  if (error || !device) throw error ?? new Error('device enrollment failed')

  const { error: otkError } = await supabase.from('one_time_prekeys').insert(
    keys.oneTimeKeys.map((k) => ({
      device_id: device.id,
      key_id: k.keyId,
      prekey: k.key,
    })),
  )
  if (otkError) throw otkError

  const next: StoredIdentity = {
    userId,
    deviceId: device.id,
    accountPickle,
    pickleKey,
    identityKey: keys.identityKey,
    signingKey: keys.signingKey,
  }
  await saveIdentity(next)
  deviceCache.set(device.id, device as DeviceRow)
  return next
}

/**
 * Load this browser's device identity, enrolling a fresh one if needed.
 * Safe to call repeatedly; the work happens once.
 */
export function ensureDevice(userId: string): Promise<StoredIdentity> {
  if (identity?.userId === userId) return Promise.resolve(identity)
  if (initPromise) return initPromise

  const run = (async () => {
    const stored = await loadIdentity()

    if (stored && stored.userId === userId) {
      const { data } = await supabase
        .from('devices')
        .select('*')
        .eq('id', stored.deviceId)
        .maybeSingle()
      if (data && !data.revoked_at) {
        identity = stored
        deviceCache.set(data.id, data as DeviceRow)
        void maybeReplenishPrekeys()
        return stored
      }
    }

    // Different account previously used here, or our device row is gone/revoked.
    if (stored) await wipeAll()
    identity = await enrollNewDevice(userId)
    return identity
  })()

  initPromise = run
  run.finally(() => {
    if (initPromise === run) initPromise = null
  })
  return run
}

export function currentDevice(): StoredIdentity | null {
  return identity
}

export async function getDevice(deviceId: string): Promise<DeviceRow | null> {
  const cached = deviceCache.get(deviceId)
  if (cached) return cached
  const { data } = await supabase
    .from('devices')
    .select('*')
    .eq('id', deviceId)
    .maybeSingle()
  if (data) deviceCache.set(deviceId, data as DeviceRow)
  return (data as DeviceRow) ?? null
}

async function recipientDevices(userIds: string[]): Promise<DeviceRow[]> {
  const { data, error } = await supabase
    .from('devices')
    .select('*')
    .in('user_id', userIds)
    .is('revoked_at', null)
  if (error) throw error
  const rows = (data ?? []) as DeviceRow[]
  for (const row of rows) deviceCache.set(row.id, row)
  return rows
}

async function bundleFor(device: DeviceRow): Promise<PrekeyBundle> {
  const { data } = await supabase.rpc('claim_prekey', { target_device: device.id })
  const claimed = Array.isArray(data) ? data[0] : undefined
  return {
    identityKey: device.identity_key,
    signingKey: device.signing_key,
    oneTimeKey: claimed
      ? { keyId: claimed.key_id, key: claimed.prekey }
      : undefined,
    fallbackKey: claimed
      ? undefined
      : { key: device.signed_prekey, sig: device.signed_prekey_sig },
  }
}

export interface OutgoingPayload {
  recipient_device_id: string
  olm_type: 0 | 1
  ciphertext: string
}

/**
 * Encrypt one plaintext for every non-revoked device belonging to the
 * conversation's participants — including the sender's *other* devices, but not
 * the device doing the sending.
 */
export async function encryptForParticipants(
  participantUserIds: string[],
  plaintext: string,
): Promise<OutgoingPayload[]> {
  if (!identity) throw new Error('crypto not initialised')
  const targets = (await recipientDevices(participantUserIds)).filter(
    (d) => d.id !== identity!.deviceId,
  )

  const out: OutgoingPayload[] = []
  for (const device of targets) {
    const sessions = await getSessions(device.id)
    const existing = sessions[0]
    const { sessionPickle, payload }: { sessionPickle: string; payload: MessagePayload } =
      await encrypt({
        accountPickle: identity.accountPickle,
        pickleKey: identity.pickleKey,
        plaintext,
        sessionPickle: existing,
        bundle: existing ? undefined : await bundleFor(device),
      })
    await putSessions(
      device.id,
      [sessionPickle, ...sessions.filter((s) => s !== existing)].slice(
        0,
        MAX_SESSIONS_PER_PEER,
      ),
    )
    out.push({
      recipient_device_id: device.id,
      olm_type: payload.type,
      ciphertext: payload.body,
    })
  }
  return out
}

/** Decrypt a payload addressed to this device. */
export async function decryptFromDevice(
  senderDeviceId: string,
  payload: MessagePayload,
): Promise<string> {
  if (!identity) throw new Error('crypto not initialised')
  const sender = await getDevice(senderDeviceId)
  if (!sender) throw new Error('unknown sender device')

  const sessions = await getSessions(senderDeviceId)
  const result = await decrypt({
    accountPickle: identity.accountPickle,
    pickleKey: identity.pickleKey,
    senderIdentityKey: sender.identity_key,
    sessionPickles: sessions,
    payload,
  })

  if (result.createdNewSession) {
    identity = { ...identity, accountPickle: result.accountPickle }
    await saveIdentity(identity)
    void maybeReplenishPrekeys()
  }
  await putSessions(
    senderDeviceId,
    [result.sessionPickle, ...sessions.filter((s) => s !== result.sessionPickle)].slice(
      0,
      MAX_SESSIONS_PER_PEER,
    ),
  )
  return result.plaintext
}

const inFlight = new Map<string, Promise<string>>()

export interface IncomingMessage {
  messageId: string
  conversationId: string
  senderUserId: string
  senderDeviceId: string
  createdAt: string
  payload: MessagePayload
}

/**
 * Decrypt an inbound message exactly once, then serve every later read from the
 * local plaintext cache. (An Olm ratchet ciphertext can only be decrypted a
 * single time.)
 */
export async function receiveMessage(msg: IncomingMessage): Promise<string> {
  const cached = await getCachedMessage(msg.messageId)
  if (cached) return cached.text

  const existing = inFlight.get(msg.messageId)
  if (existing) return existing

  const work = (async () => {
    const text = await decryptFromDevice(msg.senderDeviceId, msg.payload)
    await cacheMessage({
      messageId: msg.messageId,
      conversationId: msg.conversationId,
      senderUserId: msg.senderUserId,
      text,
      createdAt: msg.createdAt,
    })
    return text
  })()
  inFlight.set(msg.messageId, work)
  try {
    return await work
  } finally {
    inFlight.delete(msg.messageId)
  }
}

/** Record the plaintext of a message this device just sent, for our own UI. */
export async function rememberSent(entry: {
  messageId: string
  conversationId: string
  senderUserId: string
  text: string
  createdAt: string
}): Promise<void> {
  await cacheMessage(entry)
}

/** Symmetric fingerprint between this device and the peer's first device. */
export async function safetyNumberWith(peerUserId: string): Promise<string | null> {
  if (!identity) return null
  const { data } = await supabase
    .from('devices')
    .select('signing_key')
    .eq('user_id', peerUserId)
    .is('revoked_at', null)
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle()
  if (!data) return null
  return safetyNumber(identity.signingKey, data.signing_key)
}

/** Wipe this browser's keys entirely. History encrypted to it becomes unreadable. */
export async function forgetThisDevice(): Promise<void> {
  if (identity) {
    await supabase
      .from('devices')
      .update({ revoked_at: new Date().toISOString() })
      .eq('id', identity.deviceId)
  }
  await wipeAll()
  identity = null
  deviceCache.clear()
}
