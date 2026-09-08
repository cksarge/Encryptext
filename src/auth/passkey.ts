/**
 * Device-local passwordless re-login, built entirely on the client — no auth
 * Edge Function required.
 *
 * How it works: a platform passkey is created with the WebAuthn PRF extension.
 * PRF lets us derive a stable secret from the authenticator during an
 * assertion. We use that secret to AES-GCM-encrypt the Supabase refresh token
 * and stash the ciphertext in localStorage. "Sign in with a passkey" does an
 * assertion, re-derives the secret, decrypts the refresh token, and calls
 * `supabase.auth.setSession`.
 *
 * Supabase rotates refresh tokens, so the wrapped copy has to be kept current:
 * after a register/login the derived AES key is held in memory for the tab, and
 * `refreshWrappedToken` re-wraps the latest token on every token refresh without
 * another biometric prompt. Combined with a local-scope sign-out (which does not
 * revoke the token server-side), the stored token stays valid across a
 * log-out / log-back-in.
 *
 * Because the secret only exists after a successful biometric/PIN check on this
 * device, the stored refresh token is useless to anyone who copies localStorage.
 */

import { supabase } from '@/lib/supabase'
import { base64ToBytes, bytesToBase64 } from '@/lib/utils'

const STORE_KEY = 'encryptext:passkey'
const RP_NAME = 'Encryptext'
const PRF_SALT = new TextEncoder().encode('encryptext:refresh-token:v1')

interface StoredPasskey {
  credentialId: string // base64
  wrapSalt: string // base64, random per registration
  ciphertext: string // base64 (AES-GCM of the refresh token)
  iv: string // base64
  email: string
}

/** Derived AES key for this tab's lifetime, so re-wraps need no new ceremony. */
let liveKey: CryptoKey | null = null

function read(): StoredPasskey | null {
  try {
    const raw = localStorage.getItem(STORE_KEY)
    return raw ? (JSON.parse(raw) as StoredPasskey) : null
  } catch {
    return null
  }
}

function write(record: StoredPasskey): void {
  localStorage.setItem(STORE_KEY, JSON.stringify(record))
}

export function hasPasskey(): boolean {
  return read() !== null
}

export function passkeyEmail(): string | null {
  return read()?.email ?? null
}

export function clearPasskey(): void {
  liveKey = null
  try {
    localStorage.removeItem(STORE_KEY)
  } catch {
    /* ignore */
  }
}

export async function isPasskeySupported(): Promise<boolean> {
  if (
    typeof window === 'undefined' ||
    !window.PublicKeyCredential ||
    !navigator.credentials
  ) {
    return false
  }
  try {
    return await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable()
  } catch {
    return false
  }
}

function randomBytes(n: number): Uint8Array<ArrayBuffer> {
  const b = new Uint8Array(n)
  crypto.getRandomValues(b)
  return b
}

async function deriveKey(
  prf: ArrayBuffer,
  salt: Uint8Array<ArrayBuffer>,
): Promise<CryptoKey> {
  const base = await crypto.subtle.importKey('raw', prf, 'HKDF', false, [
    'deriveKey',
  ])
  return crypto.subtle.deriveKey(
    { name: 'HKDF', hash: 'SHA-256', salt, info: new Uint8Array() },
    base,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  )
}

interface PrfExtensionResults {
  prf?: { results?: { first?: ArrayBuffer | BufferSource } }
}

function prfSecret(cred: PublicKeyCredential): ArrayBuffer {
  const results = cred.getClientExtensionResults() as PrfExtensionResults
  const first = results.prf?.results?.first
  if (!first) {
    throw new Error(
      'This browser/authenticator did not return a PRF secret. Passkey sign-in is unavailable here.',
    )
  }
  if (first instanceof ArrayBuffer) return first
  const view = first as ArrayBufferView
  return view.buffer.slice(
    view.byteOffset,
    view.byteOffset + view.byteLength,
  ) as ArrayBuffer
}

async function wrapToken(
  key: CryptoKey,
  refreshToken: string,
): Promise<{ ciphertext: string; iv: string }> {
  const iv = randomBytes(12)
  const cipher = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    new TextEncoder().encode(refreshToken),
  )
  return {
    ciphertext: bytesToBase64(new Uint8Array(cipher)),
    iv: bytesToBase64(iv),
  }
}

/**
 * Re-encrypt the latest refresh token under the in-memory key. No-op when no
 * passkey login/registration has happened in this tab. Called on every Supabase
 * token refresh so the stored copy never goes stale.
 */
export async function refreshWrappedToken(refreshToken: string): Promise<void> {
  const record = read()
  if (!liveKey || !record || !refreshToken) return
  try {
    const { ciphertext, iv } = await wrapToken(liveKey, refreshToken)
    write({ ...record, ciphertext, iv })
  } catch {
    /* leave the previous wrapped token in place */
  }
}

/**
 * Register a passkey for the currently-signed-in user and wrap their refresh
 * token with it. Must be called while a session is active.
 */
export async function registerPasskey(): Promise<void> {
  const { data } = await supabase.auth.getSession()
  const session = data.session
  if (!session) throw new Error('Sign in before creating a passkey.')

  const userId = session.user.id
  const email = session.user.email ?? 'you'

  const created = (await navigator.credentials.create({
    publicKey: {
      rp: { name: RP_NAME, id: window.location.hostname },
      user: {
        id: new TextEncoder().encode(userId),
        name: email,
        displayName: email,
      },
      challenge: randomBytes(32),
      pubKeyCredParams: [
        { type: 'public-key', alg: -7 },
        { type: 'public-key', alg: -257 },
      ],
      authenticatorSelection: {
        residentKey: 'required',
        userVerification: 'required',
      },
      timeout: 60_000,
      extensions: { prf: { eval: { first: PRF_SALT } } },
    },
  })) as PublicKeyCredential | null
  if (!created) throw new Error('Passkey creation was cancelled.')

  // Some authenticators only return PRF output on assertion, so do one now.
  const asserted = (await navigator.credentials.get({
    publicKey: {
      rpId: window.location.hostname,
      challenge: randomBytes(32),
      allowCredentials: [{ type: 'public-key', id: created.rawId }],
      userVerification: 'required',
      timeout: 60_000,
      extensions: { prf: { eval: { first: PRF_SALT } } },
    },
  })) as PublicKeyCredential | null
  if (!asserted) throw new Error('Passkey verification was cancelled.')

  const wrapSalt = randomBytes(16)
  const key = await deriveKey(prfSecret(asserted), wrapSalt)
  const { ciphertext, iv } = await wrapToken(key, session.refresh_token)

  write({
    credentialId: bytesToBase64(new Uint8Array(created.rawId)),
    wrapSalt: bytesToBase64(wrapSalt),
    ciphertext,
    iv,
    email,
  })
  liveKey = key
}

/** Assert the stored passkey and restore the Supabase session from it. */
export async function loginWithPasskey(): Promise<void> {
  const record = read()
  if (!record) {
    throw new Error(
      'No passkey is saved on this device. Sign in with your password, then add one in Settings.',
    )
  }

  const asserted = (await navigator.credentials.get({
    publicKey: {
      rpId: window.location.hostname,
      challenge: randomBytes(32),
      allowCredentials: [
        { type: 'public-key', id: base64ToBytes(record.credentialId) },
      ],
      userVerification: 'required',
      timeout: 60_000,
      extensions: { prf: { eval: { first: PRF_SALT } } },
    },
  })) as PublicKeyCredential | null
  if (!asserted) throw new Error('Passkey verification was cancelled.')

  const key = await deriveKey(prfSecret(asserted), base64ToBytes(record.wrapSalt))
  let refreshToken: string
  try {
    const plain = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: base64ToBytes(record.iv) },
      key,
      base64ToBytes(record.ciphertext),
    )
    refreshToken = new TextDecoder().decode(plain)
  } catch {
    clearPasskey()
    throw new Error(
      'This passkey’s stored data is unreadable. Sign in with your password and re-add it.',
    )
  }

  const { data, error } = await supabase.auth.setSession({
    access_token: '',
    refresh_token: refreshToken,
  })
  if (error || !data.session) {
    // Keep the passkey — the credential is fine, only the wrapped token aged out.
    throw new Error(
      'Your saved passkey session has expired. Sign in with your password, then re-add the passkey in Settings.',
    )
  }

  // Session is live again — keep the key and immediately re-wrap the freshly
  // rotated token so the next passkey sign-in works.
  liveKey = key
  await refreshWrappedToken(data.session.refresh_token)
}
