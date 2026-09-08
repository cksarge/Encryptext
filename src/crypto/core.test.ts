import { beforeAll, describe, expect, it } from 'vitest'
import {
  createAccount,
  decrypt,
  encrypt,
  type MessagePayload,
  type PrekeyBundle,
  type PublishedKeys,
  replenishKeys,
  safetyNumber,
} from './core'
import { loadOlm as loadOlmForTests } from './olm-loader'

const PICKLE_KEY = 'test-pickle-key'

/** In-memory stand-in for the IndexedDB session cache + Supabase prekey server. */
class Peer {
  accountPickle!: string
  keys!: PublishedKeys
  /** peerIdentityKey -> session pickles */
  private sessions = new Map<string, string[]>()

  static async create(): Promise<Peer> {
    const peer = new Peer()
    const { accountPickle, keys } = await createAccount(PICKLE_KEY, 5)
    peer.accountPickle = accountPickle
    peer.keys = keys
    return peer
  }

  /** Hand out a bundle the way `claim_prekey` + a devices row would. */
  takeBundle(): PrekeyBundle {
    const oneTimeKey = this.keys.oneTimeKeys.shift()
    return {
      identityKey: this.keys.identityKey,
      signingKey: this.keys.signingKey,
      oneTimeKey,
      fallbackKey: oneTimeKey
        ? undefined
        : { key: this.keys.fallbackKey, sig: this.keys.fallbackKeySig },
    }
  }

  async send(to: Peer, plaintext: string): Promise<MessagePayload> {
    const existing = this.sessions.get(to.keys.identityKey)?.[0]
    const { sessionPickle, payload } = await encrypt({
      accountPickle: this.accountPickle,
      pickleKey: PICKLE_KEY,
      plaintext,
      sessionPickle: existing,
      bundle: existing ? undefined : to.takeBundle(),
    })
    this.sessions.set(to.keys.identityKey, [sessionPickle])
    return payload
  }

  async receive(from: Peer, payload: MessagePayload): Promise<string> {
    const known = this.sessions.get(from.keys.identityKey) ?? []
    const result = await decrypt({
      accountPickle: this.accountPickle,
      pickleKey: PICKLE_KEY,
      senderIdentityKey: from.keys.identityKey,
      sessionPickles: known,
      payload,
    })
    this.accountPickle = result.accountPickle
    this.sessions.set(from.keys.identityKey, [result.sessionPickle])
    return result.plaintext
  }
}

describe('crypto core (libolm Double Ratchet)', () => {
  beforeAll(async () => {
    await loadOlmForTests()
  })

  it('round-trips a message from a fresh session', async () => {
    const alice = await Peer.create()
    const bob = await Peer.create()

    const payload = await alice.send(bob, 'hello bob')
    expect(payload.type).toBe(0) // pre-key message
    expect(await bob.receive(alice, payload)).toBe('hello bob')
  })

  it('survives 100 alternating messages (ratchet advances both ways)', async () => {
    const alice = await Peer.create()
    const bob = await Peer.create()

    for (let i = 0; i < 100; i += 1) {
      const fromAlice = await alice.send(bob, `a${i}`)
      expect(await bob.receive(alice, fromAlice)).toBe(`a${i}`)

      const fromBob = await bob.send(alice, `b${i}`)
      expect(await alice.receive(bob, fromBob)).toBe(`b${i}`)
    }
  })

  it('recovers out-of-order messages', async () => {
    const alice = await Peer.create()
    const bob = await Peer.create()

    const m1 = await alice.send(bob, 'one')
    const m2 = await alice.send(bob, 'two')
    const m3 = await alice.send(bob, 'three')

    expect(await bob.receive(alice, m3)).toBe('three')
    expect(await bob.receive(alice, m1)).toBe('one')
    expect(await bob.receive(alice, m2)).toBe('two')
  })

  it('rejects a tampered ciphertext', async () => {
    const alice = await Peer.create()
    const bob = await Peer.create()

    const payload = await alice.send(bob, 'sensitive')
    const flipped = payload.body[10] === 'A' ? 'B' : 'A'
    const tampered: MessagePayload = {
      type: payload.type,
      body: payload.body.slice(0, 10) + flipped + payload.body.slice(11),
    }
    await expect(bob.receive(alice, tampered)).rejects.toThrow()
  })

  it('falls back to the signed fallback key when one-time keys are exhausted', async () => {
    const alice = await Peer.create()
    const bob = await Peer.create()
    bob.keys.oneTimeKeys = [] // drain the pool

    const payload = await alice.send(bob, 'via fallback')
    expect(await bob.receive(alice, payload)).toBe('via fallback')
  })

  it('rejects a fallback key whose signature does not verify', async () => {
    const alice = await Peer.create()
    const bob = await Peer.create()

    const bundle: PrekeyBundle = {
      identityKey: bob.keys.identityKey,
      signingKey: bob.keys.signingKey,
      fallbackKey: { key: bob.keys.fallbackKey, sig: 'not-a-real-signature' },
    }
    await expect(
      encrypt({
        accountPickle: alice.accountPickle,
        pickleKey: PICKLE_KEY,
        plaintext: 'x',
        bundle,
      }),
    ).rejects.toThrow()
  })

  it('cannot decrypt a ratchet message with no session', async () => {
    const alice = await Peer.create()
    const bob = await Peer.create()

    await expect(
      decrypt({
        accountPickle: bob.accountPickle,
        pickleKey: PICKLE_KEY,
        senderIdentityKey: alice.keys.identityKey,
        sessionPickles: [],
        payload: { type: 1, body: 'AAAA' },
      }),
    ).rejects.toThrow()
  })

  it('replenishes one-time keys', async () => {
    const { accountPickle } = await createAccount(PICKLE_KEY, 2)
    const res = await replenishKeys(accountPickle, PICKLE_KEY, 10)
    expect(res.oneTimeKeys.length).toBe(10)
    expect(res.oneTimeKeys[0].keyId).toBeTruthy()
  })

  it('produces a symmetric safety number', async () => {
    const alice = await Peer.create()
    const bob = await Peer.create()
    const ab = await safetyNumber(alice.keys.signingKey, bob.keys.signingKey)
    const ba = await safetyNumber(bob.keys.signingKey, alice.keys.signingKey)
    expect(ab).toBe(ba)
    expect(ab).toMatch(/^[\d ]+$/)
  })
})
