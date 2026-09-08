/**
 * IndexedDB persistence for this browser's Olm identity and its per-peer
 * ratchet sessions. Nothing here ever leaves the device.
 *
 * The pickle key is stored alongside the pickled account. That means the
 * at-rest protection is only as strong as the browser profile; an optional
 * passphrase lock (Argon2id -> wrap the whole record) is the documented
 * hardening step and is intentionally out of scope for v1.
 */

const DB_NAME = 'encryptext'
const DB_VERSION = 2
const KEYVAL = 'keyval'
const SESSIONS = 'sessions'
const PLAINTEXT = 'plaintext'
const IDENTITY_KEY = 'identity'

export interface StoredIdentity {
  userId: string
  deviceId: string
  accountPickle: string
  pickleKey: string
  /** curve25519 — cached for convenience, also lives in the devices row. */
  identityKey: string
  /** ed25519 — used to render this device's half of a safety number. */
  signingKey: string
}

interface SessionRecord {
  peerDeviceId: string
  pickles: string[]
  updatedAt: number
}

let dbPromise: Promise<IDBDatabase> | null = null

function openDb(): Promise<IDBDatabase> {
  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, DB_VERSION)
      req.onupgradeneeded = () => {
        const db = req.result
        if (!db.objectStoreNames.contains(KEYVAL)) db.createObjectStore(KEYVAL)
        if (!db.objectStoreNames.contains(SESSIONS)) {
          db.createObjectStore(SESSIONS, { keyPath: 'peerDeviceId' })
        }
        if (!db.objectStoreNames.contains(PLAINTEXT)) {
          const store = db.createObjectStore(PLAINTEXT, { keyPath: 'messageId' })
          store.createIndex('byConversation', 'conversationId')
        }
      }
      req.onsuccess = () => resolve(req.result)
      req.onerror = () => reject(req.error)
    })
  }
  return dbPromise
}

function tx<T>(
  store: string,
  mode: IDBTransactionMode,
  run: (s: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  return openDb().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const t = db.transaction(store, mode)
        const req = run(t.objectStore(store))
        req.onsuccess = () => resolve(req.result)
        req.onerror = () => reject(req.error)
      }),
  )
}

export async function loadIdentity(): Promise<StoredIdentity | null> {
  const value = await tx<StoredIdentity | undefined>(KEYVAL, 'readonly', (s) =>
    s.get(IDENTITY_KEY),
  )
  return value ?? null
}

export async function saveIdentity(identity: StoredIdentity): Promise<void> {
  await tx(KEYVAL, 'readwrite', (s) => s.put(identity, IDENTITY_KEY))
}

export async function getSessions(peerDeviceId: string): Promise<string[]> {
  const rec = await tx<SessionRecord | undefined>(SESSIONS, 'readonly', (s) =>
    s.get(peerDeviceId),
  )
  return rec?.pickles ?? []
}

export async function putSessions(
  peerDeviceId: string,
  pickles: string[],
): Promise<void> {
  const rec: SessionRecord = { peerDeviceId, pickles, updatedAt: Date.now() }
  await tx(SESSIONS, 'readwrite', (s) => s.put(rec))
}

/**
 * Locally-held plaintext, keyed by message id. Holds both messages this device
 * sent and messages it has decrypted — an Olm ratchet ciphertext only decrypts
 * once, so the readable copy has to be cached here.
 */
export interface CachedMessage {
  messageId: string
  conversationId: string
  senderUserId: string
  text: string
  createdAt: string
}

export async function cacheMessage(entry: CachedMessage): Promise<void> {
  await tx(PLAINTEXT, 'readwrite', (s) => s.put(entry))
}

export async function getCachedMessage(
  messageId: string,
): Promise<CachedMessage | null> {
  const rec = await tx<CachedMessage | undefined>(PLAINTEXT, 'readonly', (s) =>
    s.get(messageId),
  )
  return rec ?? null
}

export function forgetCachedMessage(messageId: string): Promise<void> {
  return tx(PLAINTEXT, 'readwrite', (s) => s.delete(messageId)) as Promise<void>
}

export async function forgetConversationMessages(
  conversationId: string,
): Promise<void> {
  const db = await openDb()
  await new Promise<void>((resolve, reject) => {
    const t = db.transaction(PLAINTEXT, 'readwrite')
    const index = t.objectStore(PLAINTEXT).index('byConversation')
    const cursorReq = index.openCursor(IDBKeyRange.only(conversationId))
    cursorReq.onsuccess = () => {
      const cursor = cursorReq.result
      if (cursor) {
        cursor.delete()
        cursor.continue()
      } else {
        resolve()
      }
    }
    cursorReq.onerror = () => reject(cursorReq.error)
  })
}

/** Full reset for "forget this device" — after this the account is unrecoverable. */
export async function wipeAll(): Promise<void> {
  await tx(KEYVAL, 'readwrite', (s) => s.clear())
  await tx(SESSIONS, 'readwrite', (s) => s.clear())
  await tx(PLAINTEXT, 'readwrite', (s) => s.clear())
}
