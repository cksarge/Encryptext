import {
  loadOlm,
  type OlmAccount,
  type OlmEncryptResult,
  type OlmUtility,
} from './olm-loader'

/**
 * Pure, dependency-free crypto layer over libolm.
 *
 * Everything here operates on *pickled* strings (libolm's encrypted-at-rest
 * serialisation) so the caller owns all persistence. No IndexedDB, no Supabase,
 * no singletons — which is exactly what makes it unit-testable with two
 * in-memory identities.
 */

export interface OneTimeKey {
  keyId: string
  key: string
}

/** What a freshly enrolled device publishes to the Supabase "prekey server". */
export interface PublishedKeys {
  /** curve25519 — used for ECDH / session setup. */
  identityKey: string
  /** ed25519 — used for signatures and the human-verifiable fingerprint. */
  signingKey: string
  /** libolm fallback key — plays the role of Signal's signed prekey. */
  fallbackKey: string
  fallbackKeySig: string
  oneTimeKeys: OneTimeKey[]
}

/** What a sender fetches about a target device before opening a session. */
export interface PrekeyBundle {
  identityKey: string
  signingKey: string
  /** Preferred: a real one-time key, consumed on use. */
  oneTimeKey?: OneTimeKey
  /** Fallback when the target's one-time pool is exhausted. */
  fallbackKey?: { key: string; sig: string }
}

export type MessagePayload = OlmEncryptResult

const DEFAULT_OTK_COUNT = 50

function parseIdentityKeys(json: string): { curve25519: string; ed25519: string } {
  return JSON.parse(json) as { curve25519: string; ed25519: string }
}

function collectOneTimeKeys(account: OlmAccount): OneTimeKey[] {
  const parsed = JSON.parse(account.one_time_keys()) as {
    curve25519: Record<string, string>
  }
  return Object.entries(parsed.curve25519).map(([keyId, key]) => ({ keyId, key }))
}

/** Create a brand-new device identity and its first batch of published keys. */
export async function createAccount(
  pickleKey: string,
  otkCount = DEFAULT_OTK_COUNT,
): Promise<{ accountPickle: string; keys: PublishedKeys }> {
  const Olm = await loadOlm()
  const account = new Olm.Account()
  try {
    account.create()

    const identity = parseIdentityKeys(account.identity_keys())

    account.generate_fallback_key()
    const fallbackParsed = JSON.parse(account.unpublished_fallback_key()) as {
      curve25519: Record<string, string>
    }
    const fallbackKey = Object.values(fallbackParsed.curve25519)[0]
    const fallbackKeySig = account.sign(fallbackKey)

    account.generate_one_time_keys(otkCount)
    const oneTimeKeys = collectOneTimeKeys(account)

    account.mark_keys_as_published()

    return {
      accountPickle: account.pickle(pickleKey),
      keys: {
        identityKey: identity.curve25519,
        signingKey: identity.ed25519,
        fallbackKey,
        fallbackKeySig,
        oneTimeKeys,
      },
    }
  } finally {
    account.free()
  }
}

/**
 * Generate more one-time keys (and refresh the fallback key) when the server
 * pool runs low. Returns only the keys that still need uploading.
 */
export async function replenishKeys(
  accountPickle: string,
  pickleKey: string,
  count = DEFAULT_OTK_COUNT,
): Promise<{
  accountPickle: string
  oneTimeKeys: OneTimeKey[]
  fallbackKey?: { key: string; sig: string }
}> {
  const Olm = await loadOlm()
  const account = new Olm.Account()
  try {
    account.unpickle(pickleKey, accountPickle)

    account.generate_one_time_keys(count)
    const oneTimeKeys = collectOneTimeKeys(account)

    let fallbackKey: { key: string; sig: string } | undefined
    const unpublished = JSON.parse(account.unpublished_fallback_key()) as {
      curve25519: Record<string, string>
    }
    const pendingFallback = Object.values(unpublished.curve25519)[0]
    if (pendingFallback) {
      fallbackKey = { key: pendingFallback, sig: account.sign(pendingFallback) }
    }

    account.mark_keys_as_published()

    return { accountPickle: account.pickle(pickleKey), oneTimeKeys, fallbackKey }
  } finally {
    account.free()
  }
}

/** Rotate the fallback key; call periodically and forget the previous one. */
export async function rotateFallbackKey(
  accountPickle: string,
  pickleKey: string,
): Promise<{ accountPickle: string; fallbackKey: { key: string; sig: string } }> {
  const Olm = await loadOlm()
  const account = new Olm.Account()
  try {
    account.unpickle(pickleKey, accountPickle)
    account.forget_old_fallback_key()
    account.generate_fallback_key()
    const unpublished = JSON.parse(account.unpublished_fallback_key()) as {
      curve25519: Record<string, string>
    }
    const key = Object.values(unpublished.curve25519)[0]
    const fallbackKey = { key, sig: account.sign(key) }
    account.mark_keys_as_published()
    return { accountPickle: account.pickle(pickleKey), fallbackKey }
  } finally {
    account.free()
  }
}

function assertBundleTrusted(utility: OlmUtility, bundle: PrekeyBundle): void {
  if (bundle.fallbackKey && !bundle.oneTimeKey) {
    // ed25519_verify throws on mismatch.
    utility.ed25519_verify(
      bundle.signingKey,
      bundle.fallbackKey.key,
      bundle.fallbackKey.sig,
    )
  }
}

export interface EncryptArgs {
  accountPickle: string
  pickleKey: string
  plaintext: string
  /** Existing per-peer session, if one has already been established. */
  sessionPickle?: string
  /** Required only when there is no existing session. */
  bundle?: PrekeyBundle
}

export async function encrypt(args: EncryptArgs): Promise<{
  sessionPickle: string
  payload: MessagePayload
}> {
  const Olm = await loadOlm()
  const account = new Olm.Account()
  const session = new Olm.Session()
  const utility = new Olm.Utility()
  try {
    account.unpickle(args.pickleKey, args.accountPickle)

    if (args.sessionPickle) {
      session.unpickle(args.pickleKey, args.sessionPickle)
    } else {
      if (!args.bundle) {
        throw new Error('encrypt: a PrekeyBundle is required to start a session')
      }
      assertBundleTrusted(utility, args.bundle)
      const seed = args.bundle.oneTimeKey?.key ?? args.bundle.fallbackKey?.key
      if (!seed) {
        throw new Error('encrypt: bundle has neither a one-time key nor a fallback key')
      }
      session.create_outbound(account, args.bundle.identityKey, seed)
    }

    const payload = session.encrypt(args.plaintext)
    return { sessionPickle: session.pickle(args.pickleKey), payload }
  } finally {
    utility.free()
    session.free()
    account.free()
  }
}

export interface DecryptArgs {
  accountPickle: string
  pickleKey: string
  senderIdentityKey: string
  /** Every session we currently hold for this peer device. */
  sessionPickles: string[]
  payload: MessagePayload
}

export interface DecryptResult {
  plaintext: string
  /** Re-pickled session that decrypted (or was newly created). Persist it. */
  sessionPickle: string
  /** Re-pickled account — only changed when a one-time key was consumed. */
  accountPickle: string
  createdNewSession: boolean
}

export async function decrypt(args: DecryptArgs): Promise<DecryptResult> {
  const Olm = await loadOlm()
  const account = new Olm.Account()
  try {
    account.unpickle(args.pickleKey, args.accountPickle)

    // 1. Try every session we already have for this peer.
    for (const pickle of args.sessionPickles) {
      const session = new Olm.Session()
      try {
        session.unpickle(args.pickleKey, pickle)
        const usable =
          args.payload.type === 1 ||
          session.matches_inbound_from(args.senderIdentityKey, args.payload.body)
        if (!usable) continue
        const plaintext = session.decrypt(args.payload.type, args.payload.body)
        return {
          plaintext,
          sessionPickle: session.pickle(args.pickleKey),
          accountPickle: args.accountPickle,
          createdNewSession: false,
        }
      } catch {
        // Not this session — keep looking.
      } finally {
        session.free()
      }
    }

    // 2. No existing session worked. A pre-key message can bootstrap one.
    if (args.payload.type !== 0) {
      throw new Error(
        'decrypt: no session for a ratchet message (the message is unrecoverable)',
      )
    }

    const session = new Olm.Session()
    try {
      session.create_inbound_from(account, args.senderIdentityKey, args.payload.body)
      account.remove_one_time_keys(session)
      const plaintext = session.decrypt(args.payload.type, args.payload.body)
      return {
        plaintext,
        sessionPickle: session.pickle(args.pickleKey),
        accountPickle: account.pickle(args.pickleKey),
        createdNewSession: true,
      }
    } finally {
      session.free()
    }
  } finally {
    account.free()
  }
}

/**
 * Symmetric, human-verifiable fingerprint for a pair of devices. Both sides
 * feed the two ed25519 signing keys and get the same string, which they can
 * read to each other out of band to detect a key swap.
 */
export async function safetyNumber(
  signingKeyA: string,
  signingKeyB: string,
): Promise<string> {
  const Olm = await loadOlm()
  const utility = new Olm.Utility()
  try {
    const [lo, hi] = [signingKeyA, signingKeyB].sort()
    const digest = utility.sha256(`encryptext:v2:${lo}:${hi}`)
    const digits = Array.from(digest)
      .map((ch) => ch.charCodeAt(0) % 10)
      .join('')
      .slice(0, 60)
    return digits.replace(/(\d{5})(?=\d)/g, '$1 ')
  } finally {
    utility.free()
  }
}
