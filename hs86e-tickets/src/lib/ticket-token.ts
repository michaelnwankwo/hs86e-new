import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { getEnvSafe } from "@/lib/env";

const PREFIX = "HS86";

/**
 * All signing keys considered valid, ordered so the primary key is first.
 * A dedicated TICKET_HMAC_SECRET takes precedence; SCAN_JWT_SECRET (when
 * configured) is included so passes minted before key separation still verify.
 * Throws only in the impossible-to-serve case: minting/verifying with no key
 * at all — callers on API routes convert that into a structured JSON error.
 */
function hmacKeys(): string[] {
  const env = getEnvSafe();
  const keys: string[] = [];
  if (env.TICKET_HMAC_SECRET) keys.push(env.TICKET_HMAC_SECRET);
  if (env.SCAN_JWT_SECRET) keys.push(env.SCAN_JWT_SECRET);
  const unique = [...new Set(keys)];
  if (unique.length === 0) {
    throw new Error(
      "No QR signing key configured. Set TICKET_HMAC_SECRET or SCAN_JWT_SECRET (24+ characters).",
    );
  }
  return unique;
}

/** Primary key used to mint new signatures. */
function primaryHmacKey(): string {
  return hmacKeys()[0];
}

export function mintQrNonce() {
  return randomBytes(12).toString("base64url");
}

function signWith(ticketId: string, nonce: string, key: string) {
  const body = `${ticketId}.${nonce}`;
  return createHmac("sha256", key).update(body).digest("base64url").slice(0, 22);
}

export function signTicketPayload(ticketId: string, nonce: string) {
  return `${PREFIX}.${ticketId}.${nonce}.${signWith(ticketId, nonce, primaryHmacKey())}`;
}

export function expectedSignature(ticketId: string, nonce: string) {
  return signWith(ticketId, nonce, primaryHmacKey());
}

function safeEqual(a: string, b: string) {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}

/**
 * Timing-safe signature verification against every configured key, so rotating
 * TICKET_HMAC_SECRET does not invalidate previously issued passes.
 */
export function verifyHs86Payload(ticketId: string, nonce: string, signature: string) {
  try {
    return hmacKeys().some((key) => safeEqual(signature, signWith(ticketId, nonce, key)));
  } catch {
    return false;
  }
}

/* ---------------------------------------------------------------------------
 * RSG-ENG-SEC-006 Phase 2 — 30 s TOTP dynamic payloads.
 *
 * The client never sees a master secret: it receives a per-pass seed
 *   seed = HMAC-SHA256(master, "<ticketId>.<nonce>.hs86-totp-v2")
 * which it imports as a non-extractable WebCrypto key and uses to sign
 *   sig  = HMAC-SHA256(seed, "<ticketId>.<nonce>.<counter>")[0..22]
 * The server re-derives the seed from its own master key to verify, so
 * rotating TICKET_HMAC_SECRET/SCAN_JWT_SECRET keeps old seeds verifiable
 * (same multi-key strategy as verifyHs86Payload).
 * ------------------------------------------------------------------------- */

/** Raw per-pass seed bytes for one master key. */
function deriveTotpSeedBytes(ticketId: string, nonce: string, key: string) {
  return createHmac("sha256", key).update(`${ticketId}.${nonce}.hs86-totp-v2`).digest();
}

function totpSigWith(seed: Buffer, ticketId: string, nonce: string, counter: number) {
  return createHmac("sha256", seed)
    .update(`${ticketId}.${nonce}.${counter}`)
    .digest("base64url")
    .slice(0, 22);
}

/** Base64url seed handed to the holder's device (never persisted, never bundled). */
export function totpSeedForPresentation(ticketId: string, nonce: string): string | undefined {
  try {
    return deriveTotpSeedBytes(ticketId, nonce, primaryHmacKey()).toString("base64url");
  } catch {
    return undefined;
  }
}

/** Timing-safe v2 signature check for one counter step, across all master keys. */
export function verifyTotpPayload(
  ticketId: string,
  nonce: string,
  counter: number,
  signature: string,
): boolean {
  try {
    return hmacKeys().some((key) =>
      safeEqual(
        signature,
        totpSigWith(deriveTotpSeedBytes(ticketId, nonce, key), ticketId, nonce, counter),
      ),
    );
  } catch {
    return false;
  }
}
