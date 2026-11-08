import { randomUUID } from "node:crypto";

/** Unpredictable, unique references for money operations. Unique per intent/request. */
export function mintWalletRef(kind: "WLT-DEPOSIT" | "WLT-WD"): string {
  return `${kind}-${randomUUID().replace(/-/g, "").slice(0, 24).toUpperCase()}`;
}
