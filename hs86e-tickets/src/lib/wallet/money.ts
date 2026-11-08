/**
 * Money model — integer minor units (kobo). NGN-only for Phase 2.
 * 1 NGN = 100 kobo. Never use floats for amounts anywhere on the server.
 */
export const CURRENCY = "NGN" as const;
export const MIN_DEPOSIT_MINOR = 10_000; // ₦100
export const MAX_DEPOSIT_MINOR = 500_000_000; // ₦5,000,000 per intent
export const MIN_WITHDRAWAL_MINOR = 50_000; // ₦500
export const MAX_WITHDRAWAL_MINOR = 10_000_000; // ₦100,000 per day (reserved per request for v1)

/** Withdrawal fee: ₦100 flat under ₦10k, ₦200 at/above ₦10k. Disclosed pre-confirmation. */
export function withdrawalFeeMinor(amountMinor: number): number {
  if (!Number.isInteger(amountMinor) || amountMinor <= 0) return 0;
  return amountMinor < 1_000_000 ? 10_000 : 20_000;
}

/** Display helper only — returns major units for formatting, never for math. */
export function minorToMajor(minor: number): number {
  return Math.round(minor) / 100;
}

const nf = new Intl.NumberFormat("en-NG", { style: "currency", currency: CURRENCY, maximumFractionDigits: 0 });
export function formatMinor(minor: number): string {
  return nf.format(minorToMajor(minor));
}
