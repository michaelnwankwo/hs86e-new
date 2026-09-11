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
