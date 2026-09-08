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

function read(): StoredPasskey | null {
  try {
    const raw = localStorage.getItem(STORE_KEY)
    return raw ? (JSON.parse(raw) as StoredPasskey) : null
  } catch {
    return null
  }
}

export function hasPasskey(): boolean {
  return read() !== null
}

export function passkeyEmail(): string | null {
  return read()?.email ?? null
}

export function clearPasskey(): void {
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
  const iv = randomBytes(12)
  const key = await deriveKey(prfSecret(asserted), wrapSalt)
  const cipher = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    new TextEncoder().encode(session.refresh_token),
  )

  const record: StoredPasskey = {
    credentialId: bytesToBase64(new Uint8Array(created.rawId)),
    wrapSalt: bytesToBase64(wrapSalt),
    ciphertext: bytesToBase64(new Uint8Array(cipher)),
    iv: bytesToBase64(iv),
    email,
  }
  localStorage.setItem(STORE_KEY, JSON.stringify(record))
}

/** Assert the stored passkey and restore the Supabase session from it. */
export async function loginWithPasskey(): Promise<void> {
  const record = read()
  if (!record) throw new Error('No passkey saved on this device.')

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
    throw new Error('Stored passkey data could not be read. Sign in with your password.')
  }

  const { error } = await supabase.auth.setSession({
    access_token: '',
    refresh_token: refreshToken,
  })
  if (error) {
    clearPasskey()
    throw new Error('That passkey session has expired. Sign in with your password.')
  }
}
