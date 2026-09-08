// Pure core — safe to unit test with in-memory identities.
export {
  createAccount,
  replenishKeys,
  rotateFallbackKey,
  encrypt,
  decrypt,
  safetyNumber,
  type OneTimeKey,
  type PublishedKeys,
  type PrekeyBundle,
  type MessagePayload,
  type EncryptArgs,
  type DecryptArgs,
  type DecryptResult,
} from './core'

export { loadOlm, loadOlm as loadOlmForTests } from './olm-loader'
export type {
  OlmAccount,
  OlmSession,
  OlmUtility,
  OlmApi,
  OlmEncryptResult,
} from './olm-loader'

// Stateful app-facing API (touches IndexedDB + Supabase).
export {
  ensureDevice,
  currentDevice,
  getDevice,
  encryptForParticipants,
  decryptFromDevice,
  receiveMessage,
  rememberSent,
  safetyNumberWith,
  forgetThisDevice,
  type OutgoingPayload,
  type IncomingMessage,
} from './manager'

export {
  loadIdentity,
  wipeAll,
  getCachedMessage,
  forgetCachedMessage,
  forgetConversationMessages,
  type StoredIdentity,
  type CachedMessage,
} from './store'
