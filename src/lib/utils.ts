import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

/** Merge conditional class names, de-duping conflicting Tailwind utilities. */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs))
}

/** Sleep helper for the read -> expire countdown and retry backoff. */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/** Bytes -> base64 (browser-safe, no Buffer). */
export function bytesToBase64(bytes: Uint8Array): string {
  let binary = ''
  for (let i = 0; i < bytes.length; i += 1) {
    binary += String.fromCharCode(bytes[i])
  }
  return btoa(binary)
}

/** base64 -> bytes (backed by a plain ArrayBuffer, for WebCrypto/WebAuthn). */
export function base64ToBytes(base64: string): Uint8Array<ArrayBuffer> {
  const binary = atob(base64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i)
  }
  return bytes
}

const USERNAME_RE = /^[a-z0-9_]{3,20}$/

export interface PasswordChecks {
  length: boolean
  lower: boolean
  upper: boolean
  digit: boolean
  symbol: boolean
}

/** Mirrors the Supabase project's password policy so the user sees it up front. */
export function passwordChecks(pw: string): PasswordChecks {
  return {
    length: pw.length >= 8,
    lower: /[a-z]/.test(pw),
    upper: /[A-Z]/.test(pw),
    digit: /\d/.test(pw),
    symbol: /[^A-Za-z0-9]/.test(pw),
  }
}

export function isValidPassword(pw: string): boolean {
  return Object.values(passwordChecks(pw)).every(Boolean)
}

/** Client-side mirror of the DB constraint. UX only; the DB is the real guard. */
export function normalizeUsername(raw: string): string {
  return raw.trim().toLowerCase()
}

export function isValidUsername(raw: string): boolean {
  return USERNAME_RE.test(normalizeUsername(raw))
}
