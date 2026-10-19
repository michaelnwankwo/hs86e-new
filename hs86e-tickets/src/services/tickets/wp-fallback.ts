import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

/**
 * Local ledger for check-ins WordPress REFUSED to record (403 on an
 * authenticated request). Admission requires either FooEvents confirming an
 * unused ticket, or a valid app HMAC/TOTP QR when its server ticket row is
 * unavailable. Unsigned external IDs are admitted client-side only when the
 * trusted IndexedDB manifest confirms them. Entries here make re-scans
 * duplicates and let /api/scan/wp-sync reconcile server-recorded admissions.
 *
 * Same memory-mirror pattern as services/tickets/ledger.ts: serverless hosts
 * (Netlify) may have a read-only filesystem, so the in-memory copy keeps the
 * gate consistent for the life of the instance while writable hosts persist.
 */

export interface FallbackCheckin {
  ticketId: string;
  eventId: string;
  checkedInAt: string;
  deviceId?: string;
  attendeeName?: string;
  eventName?: string;
  /** False until WordPress has accepted the check-in via /api/scan/wp-sync. */
  synced: boolean;
  /** Exact WP failure captured at scan time (e.g. "HTTP 403 [rest_forbidden]"). */
  wpDetail?: string;
}

interface FallbackLedger {
  checkins: FallbackCheckin[];
}

const FILE = join(process.cwd(), ".data", "wp-fallback-checkins.json");

let memory: FallbackLedger | null = null;
let warnedPersist = false;

function load(): FallbackLedger {
  try {
    memory = JSON.parse(readFileSync(FILE, "utf8")) as FallbackLedger;
  } catch {
    if (!memory) memory = { checkins: [] };
  }
  return memory;
}

function save(ledger: FallbackLedger) {
  memory = ledger;
  try {
    mkdirSync(dirname(FILE), { recursive: true });
    writeFileSync(FILE, JSON.stringify(ledger, null, 2), "utf8");
  } catch (err) {
    if (!warnedPersist) {
      warnedPersist = true;
      console.warn(
        "[hs86e] Fallback check-in ledger directory is not writable on this host — keeping records in memory only.",
        err,
      );
    }
  }
}

export function getFallbackCheckin(ticketId: string): FallbackCheckin | null {
  return load().checkins.find((row) => row.ticketId === ticketId) ?? null;
}

/**
 * CAS insert: returns false when the ticket was already recorded, so two
 * concurrent scans of the same unknown-to-WP ticket cannot both admit.
 */
export function recordFallbackCheckin(entry: FallbackCheckin): boolean {
  const ledger = load();
  if (ledger.checkins.some((row) => row.ticketId === entry.ticketId)) return false;
  ledger.checkins.push(entry);
  save(ledger);
  return true;
}

export function listPendingFallbackCheckins(): FallbackCheckin[] {
  return load().checkins.filter((row) => !row.synced);
}

export function markFallbackSynced(ticketId: string) {
  const ledger = load();
  const row = ledger.checkins.find((entry) => entry.ticketId === ticketId);
  if (row) {
    row.synced = true;
    save(ledger);
  }
}
