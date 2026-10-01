/**
 * Shared gateway-status vocabulary for the checkout-success guard.
 * Plain (non-client) module so BOTH server components and client components
 * can use these sets at runtime.
 */

/** Terminal failure statuses reported by gateways — never surface passes. */
export const CANCELLED_STATUSES = new Set([
  "cancelled",
  "canceled",
  "failed",
  "error",
  "declined",
]);

/** Statuses that confirm settlement — pass UI may render. */
export const SETTLED_STATUSES = new Set([
  "completed",
  "successful",
  "success",
  "paid",
]);
