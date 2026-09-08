import OlmModule from '@matrix-org/olm'

/**
 * Minimal typed surface of libolm that we actually use. The npm package ships
 * loose ambient types; we cast the default export to this so call sites are
 * type-checked without fighting the bundled `.d.ts`.
 */
export interface OlmAccount {
  free(): void
  create(): void
  identity_keys(): string // {"curve25519":"...","ed25519":"..."}
  sign(message: string | Uint8Array): string
  one_time_keys(): string // {"curve25519":{"<id>":"<key>", ...}}
  mark_keys_as_published(): void
  max_number_of_one_time_keys(): number
  generate_one_time_keys(count: number): void
  remove_one_time_keys(session: OlmSession): void
  generate_fallback_key(): void
  fallback_key(): string
  unpublished_fallback_key(): string
  forget_old_fallback_key(): void
  pickle(key: string | Uint8Array): string
  unpickle(key: string | Uint8Array, pickle: string): void
}

export interface OlmEncryptResult {
  type: 0 | 1
  body: string
}

export interface OlmSession {
  free(): void
  pickle(key: string | Uint8Array): string
  unpickle(key: string | Uint8Array, pickle: string): void
  create_outbound(
    account: OlmAccount,
    theirIdentityKey: string,
    theirOneTimeKey: string,
  ): void
  create_inbound(account: OlmAccount, oneTimeKeyMessage: string): void
  create_inbound_from(
    account: OlmAccount,
    identityKey: string,
    oneTimeKeyMessage: string,
  ): void
  session_id(): string
  has_received_message(): boolean
  matches_inbound(oneTimeKeyMessage: string): boolean
  matches_inbound_from(identityKey: string, oneTimeKeyMessage: string): boolean
  encrypt(plaintext: string): OlmEncryptResult
  decrypt(messageType: number, message: string): string
  describe(): string
}

export interface OlmUtility {
  free(): void
  sha256(input: string | Uint8Array): string
  /** Throws if the signature does not verify. */
  ed25519_verify(key: string, message: string | Uint8Array, signature: string): void
}

export interface OlmApi {
  init(opts?: { locateFile?: (path: string) => string }): Promise<void>
  get_library_version(): [number, number, number]
  Account: new () => OlmAccount
  Session: new () => OlmSession
  Utility: new () => OlmUtility
}

const Olm = OlmModule as unknown as OlmApi

let ready: Promise<OlmApi> | null = null

/**
 * Load + initialise libolm exactly once. Every crypto call must await this
 * first — `Olm.Account` and friends only exist after the WASM runtime boots.
 */
export function loadOlm(): Promise<OlmApi> {
  if (!ready) {
    ready = (async () => {
      if (import.meta.env.MODE === 'test') {
        // Node/vitest: emscripten resolves olm.wasm next to olm.js itself.
        await Olm.init()
      } else {
        const { default: wasmUrl } = await import('@matrix-org/olm/olm.wasm?url')
        await Olm.init({ locateFile: () => wasmUrl })
      }
      return Olm
    })()
  }
  return ready
}
