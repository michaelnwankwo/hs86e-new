/**
 * RSG-ENG-SEC-006 Phase 2 — dynamic pass security (client-safe).
 *
 * v2 QR payloads rotate every 30 s: `HS86.<ticketId>.<nonce>.<counter>.<sig>`.
 * The signing key is a per-pass seed minted by the server and imported into
 * WebCrypto as a NON-EXTRACTABLE HMAC key, so no master secret ever appears
 * in the client bundle and the key cannot be exported from memory.
 *
 * This module must stay free of `node:*` imports — it ships to the browser.
 * Server-side seed derivation/verification lives in `@/lib/ticket-token`.
 */

export const TOTP_STEP_SECONDS = 30;

/** Counter value for a given instant — shared by client signing and server windows. */
export function totpCounter(nowMs: number = Date.now()): number {
  return Math.floor(nowMs / 1000 / TOTP_STEP_SECONDS);
}

function base64UrlToBytes(value: string): Uint8Array {
  const padded = value.replace(/-/g, "+").replace(/_/g, "/") + "=".repeat((4 - (value.length % 4)) % 4);
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function bytesToBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/**
 * Import the server-issued per-pass seed as a non-extractable HMAC key.
 * `extractable: false` means the raw seed cannot be read back out of
 * crypto.subtle once imported.
 */
export async function importTotpKey(seedBase64Url: string): Promise<CryptoKey> {
  const bytes = base64UrlToBytes(seedBase64Url);
  return globalThis.crypto.subtle.importKey(
    "raw",
    bytes as unknown as BufferSource,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
}

/** Sign one counter step. Message format must match the server verifier. */
export async function signTotpCounter(
  key: CryptoKey,
  ticketId: string,
  nonce: string,
  counter: number,
): Promise<string> {
  const message = new TextEncoder().encode(`${ticketId}.${nonce}.${counter}`);
  const mac = await globalThis.crypto.subtle.sign("HMAC", key, message);
  return bytesToBase64Url(new Uint8Array(mac)).slice(0, 22);
}

export function buildV2Payload(
  ticketId: string,
  nonce: string,
  counter: number,
  signature: string,
): string {
  return `HS86.${ticketId}.${nonce}.${counter}.${signature}`;
}
