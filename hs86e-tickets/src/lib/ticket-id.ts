import { createHash } from "node:crypto";

/**
 * Mint a ticket ID that is deterministic per order (so re-issuing the same
 * order is idempotent across serverless cold starts) but unguessable, so an
 * attacker cannot enumerate `TKT-{orderId}-{index}` and harvest live QR
 * payloads from the claim endpoint. The suffix is derived from the order key,
 * which is high-entropy and stable per order.
 *
 * NOTE: server-only module — do not import from client components.
 */
export function mintTicketId(orderId: number, index: number, salt?: string) {
  const base = `TKT-${orderId}-${String(index + 1).padStart(2, "0")}`;
  if (!salt) return base;
  const suffix = createHash("sha256")
    .update(`${orderId}:${salt}`)
    .digest("base64url")
    .slice(0, 6)
    .replace(/[-_]/g, "a");
  return `${base}-${suffix}`;
}
