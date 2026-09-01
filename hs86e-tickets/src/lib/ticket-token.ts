import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { getEnv } from "@/lib/env";

const PREFIX = "HS86";

function hmacKey() {
  return getEnv().SCAN_JWT_SECRET;
}

export function mintQrNonce() {
  return randomBytes(12).toString("base64url");
}

export function signTicketPayload(ticketId: string, nonce: string) {
  const body = `${ticketId}.${nonce}`;
  const sig = createHmac("sha256", hmacKey()).update(body).digest("base64url").slice(0, 22);
  return `${PREFIX}.${ticketId}.${nonce}.${sig}`;
}

export function expectedSignature(ticketId: string, nonce: string) {
  const body = `${ticketId}.${nonce}`;
  return createHmac("sha256", hmacKey()).update(body).digest("base64url").slice(0, 22);
}

function safeEqual(a: string, b: string) {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}

export function verifyHs86Payload(ticketId: string, nonce: string, signature: string) {
  try {
    return safeEqual(signature, expectedSignature(ticketId, nonce));
  } catch {
    return false;
  }
}
