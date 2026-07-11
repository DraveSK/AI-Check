/**
 * AES-GCM encryption for BYO AI provider keys at rest (D1 `api_keys`
 * table). Uses the Web Crypto API already built into the Workers
 * runtime — no dependency needed. See docs/SECURITY.md §API key handling.
 */

async function importKey(base64Key: string): Promise<CryptoKey> {
  // `wrangler secret put` / a pasted value can easily pick up a trailing
  // newline or surrounding whitespace — trim before decoding rather than
  // failing on an otherwise-correct key.
  const raw = Uint8Array.from(atob(base64Key.trim()), (c) => c.charCodeAt(0));
  if (raw.length !== 32) {
    throw new Error(`ENCRYPTION_KEY must decode to exactly 32 bytes (AES-256) — got ${raw.length}. Generate one with: openssl rand -base64 32. See docs/DEPLOYMENT.md.`);
  }
  return crypto.subtle.importKey('raw', raw, 'AES-GCM', false, ['encrypt', 'decrypt']);
}

function toBase64(bytes: ArrayBuffer | Uint8Array): string {
  const arr = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let binary = '';
  for (const byte of arr) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function fromBase64(value: string): Uint8Array {
  return Uint8Array.from(atob(value), (c) => c.charCodeAt(0));
}

export interface EncryptedValue {
  ciphertext: string; // base64
  iv: string; // base64
}

/** Encrypts a plaintext API key. The plaintext never touches disk or a
 * log line — only this ciphertext is persisted. */
export async function encryptSecret(plaintext: string, encryptionKeyBase64: string): Promise<EncryptedValue> {
  const key = await importKey(encryptionKeyBase64);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ciphertext = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, new TextEncoder().encode(plaintext));
  return { ciphertext: toBase64(ciphertext), iv: toBase64(iv) };
}

/** Decrypts back to plaintext, used only transiently in-memory to make a
 * single upstream AI provider call — never returned to the client. */
export async function decryptSecret(value: EncryptedValue, encryptionKeyBase64: string): Promise<string> {
  const key = await importKey(encryptionKeyBase64);
  // Cast: TS's DOM lib types BufferSource as ArrayBufferView<ArrayBuffer>,
  // stricter than the Uint8Array<ArrayBufferLike> Uint8Array.from() infers
  // — a real Uint8Array backed by a real ArrayBuffer at runtime either way.
  const plaintext = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: fromBase64(value.iv) as BufferSource }, key, fromBase64(value.ciphertext) as BufferSource);
  return new TextDecoder().decode(plaintext);
}

/** SHA-256 hex digest — used for magic-link tokens and session tokens so
 * only a hash is ever stored in D1 (see d1/migrations/0001_init.sql). */
export async function sha256Hex(input: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(input));
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

/** A high-entropy, URL-safe random token (32 bytes) for magic links and
 * session cookies. */
export function randomToken(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return toBase64(bytes).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
