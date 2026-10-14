import { NextResponse } from "next/server";
import { getStaffSessionFromCookies } from "@/lib/auth";
import { checkInTicket } from "@/services/wp/fooevents";
import {
  listPendingFallbackCheckins,
  markFallbackSynced,
} from "@/services/tickets/wp-fallback";

/**
 * Reconciliation endpoint for the 403 local-fallback ledger. After the
 * WordPress-side capability fix (functions.php snippet / User Role Editor),
 * a staff member POSTs here and every check-in WordPress refused is pushed
 * to FooEvents so the plugin's records match the gate.
 *
 * Per entry:
 *  - valid (real WP write) → mark synced
 *  - duplicate → WordPress already shows it checked in → mark synced
 *  - valid with wpBlocked403 → still 403 → leave pending
 *  - anything else (network, invalid) → leave pending, report the reason
 */
export async function POST() {
  const session = await getStaffSessionFromCookies();
  if (!session) {
    return NextResponse.json({ error: "Staff session required" }, { status: 401 });
  }

  const pending = listPendingFallbackCheckins();
  const results: { ticketId: string; outcome: string }[] = [];
  let synced = 0;

  for (const entry of pending) {
    try {
      const result = await checkInTicket({
        ticketId: entry.ticketId,
        eventId: entry.eventId,
        deviceId: entry.deviceId || "wp-sync",
        scannedAt: entry.checkedInAt,
      });
      // A "valid" that carries wpBlocked403 is the local fallback again —
      // WordPress still refuses the write, so it must stay pending.
      const reachedWp =
        (result.verdict === "valid" && !result.wpBlocked403) || result.verdict === "duplicate";
      if (reachedWp) {
        markFallbackSynced(entry.ticketId);
        synced += 1;
        results.push({ ticketId: entry.ticketId, outcome: `synced (${result.verdict})` });
      } else {
        results.push({ ticketId: entry.ticketId, outcome: `pending — ${result.message}` });
      }
    } catch (err) {
      results.push({
        ticketId: entry.ticketId,
        outcome: `pending — ${err instanceof Error ? err.message : String(err)}`,
      });
    }
  }

  return NextResponse.json({
    pendingBefore: pending.length,
    synced,
    stillPending: pending.length - synced,
    results,
  });
}
