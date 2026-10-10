import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { currentOwnerEmail, purchaserOf } from "@/lib/ticket-payload";
import { totpSeedForPresentation } from "@/lib/ticket-token";
import type { IssuedTicket, TicketTransferRecord } from "@/lib/types";

interface Ledger {
  tickets: IssuedTicket[];
  transfers?: TicketTransferRecord[];
}

const FILE = join(process.cwd(), ".data", "issued-tickets.json");

/**
 * In-memory mirror of the ledger. Serverless filesystems (e.g. Netlify
 * Functions) are read-only outside /tmp, so disk persistence can fail at
 * runtime; the mirror keeps the wallet/scanner consistent for the life of the
 * instance, while hosts with writable disks keep full durability as before.
 */
let memory: Ledger | null = null;
let warnedPersist = false;

function load(): Ledger {
  try {
    memory = JSON.parse(readFileSync(FILE, "utf8")) as Ledger;
  } catch {
    if (!memory) memory = { tickets: [], transfers: [] };
  }
  return memory;
}

function save(ledger: Ledger) {
  memory = ledger;
  try {
    mkdirSync(dirname(FILE), { recursive: true });
    writeFileSync(FILE, JSON.stringify(ledger, null, 2), "utf8");
  } catch (err) {
    if (!warnedPersist) {
      warnedPersist = true;
      console.warn(
        "[hs86e] Ticket ledger directory is not writable on this host — keeping records in memory only.",
        err,
      );
    }
  }
}

export function upsertIssuedTickets(tickets: IssuedTicket[]) {
  const ledger = load();
  for (const ticket of tickets) {
    if (!ticket.ticketId) continue;
    const idx = ledger.tickets.findIndex((row) => row.ticketId === ticket.ticketId);
    if (idx >= 0) ledger.tickets[idx] = ticket;
    else ledger.tickets.push(ticket);
  }
  save(ledger);
  return tickets;
}

export function ticketsForOrder(orderId: number, emailOrKey?: string) {
  const token = (emailOrKey || "").trim().toLowerCase();
  return load().tickets.filter((ticket) => {
    if (ticket.orderId !== orderId) return false;
    if (!token) return true;
    return (
      ticket.orderKey.toLowerCase() === token ||
      ticket.attendeeEmail.toLowerCase() === token ||
      currentOwnerEmail(ticket) === token ||
      purchaserOf(ticket) === token
    );
  });
}

export function ticketsByEmail(email: string) {
  const token = email.trim().toLowerCase();
  if (!token) return [];
  return load().tickets.filter((ticket) => {
    return (
      ticket.attendeeEmail.toLowerCase() === token ||
      currentOwnerEmail(ticket) === token ||
      purchaserOf(ticket) === token
    );
  });
}

export function ticketById(ticketId: string) {
  const token = ticketId.trim();
  if (!token) return null;
  return load().tickets.find((ticket) => ticket.ticketId === token) ?? null;
}

export function updateLedgerTicket(
  ticketId: string,
  patch: Partial<IssuedTicket>,
): IssuedTicket | null {
  const ledger = load();
  const idx = ledger.tickets.findIndex((ticket) => ticket.ticketId === ticketId);
  if (idx < 0) return null;
  ledger.tickets[idx] = { ...ledger.tickets[idx], ...patch };
  save(ledger);
  return ledger.tickets[idx];
}

/**
 * CAS check-in (RSG-ENG-SEC-006 Phase 1): atomically transition a pass to
 * "Checked In". A second writer for the same ticketId observes
 * `transitioned: false` so the gate answers ALREADY SCANNED instead of
 * double-admitting under concurrent scans.
 */
export function checkInLedgerTicket(
  ticketId: string,
  when: string,
): { transitioned: boolean; ticket: IssuedTicket | null } {
  const ledger = load();
  const idx = ledger.tickets.findIndex((ticket) => ticket.ticketId === ticketId);
  if (idx < 0) return { transitioned: false, ticket: null };
  const current = ledger.tickets[idx];
  if (current.status === "Checked In") {
    return { transitioned: false, ticket: current };
  }
  ledger.tickets[idx] = { ...current, status: "Checked In", checkedInAt: when };
  save(ledger);
  return { transitioned: true, ticket: ledger.tickets[idx] };
}

export function allLedgerTickets() {
  return load().tickets;
}

export function ticketsForEvent(eventId: string) {
  if (!eventId) return load().tickets;
  return load().tickets.filter((ticket) => ticket.eventId === eventId);
}

export function recordTransfer(entry: TicketTransferRecord) {
  const ledger = load();
  ledger.transfers = [...(ledger.transfers ?? []), entry];
  save(ledger);
}

export function transferCountForTicket(ticketId: string) {
  return (load().transfers ?? []).filter((row) => row.ticketId === ticketId).length;
}

export function presentForViewer(
  tickets: IssuedTicket[],
  viewerEmail?: string,
  opts?: { revealQr?: boolean },
): IssuedTicket[] {
  const viewer = (viewerEmail || "").trim().toLowerCase();
  return tickets.map((ticket) => {
    const assigned = currentOwnerEmail(ticket);
    const purchaser = purchaserOf(ticket);
    const transferred = Boolean(assigned && purchaser && assigned !== purchaser);
    const transferredAway = Boolean(
      transferred && (!viewer || (purchaser === viewer && assigned !== viewer)),
    );
    const holder = Boolean(opts?.revealQr) || (viewer ? assigned === viewer : !transferred);
    // Strict redaction for buyer/lookup routes:
    //  - orderKey (full order detail) is never returned to a viewer;
    //  - QR payload/token only for the current holder;
    //  - attendee phone only for the current holder.
    const { orderKey: _orderKey, ...safe } = ticket;
    return {
      ...safe,
      holder,
      assignedEmail: ticket.assignedEmail || ticket.attendeeEmail,
      purchaserEmail: ticket.purchaserEmail || ticket.attendeeEmail,
      transferredTo: transferredAway ? assigned : undefined,
      qrPayload: holder ? ticket.qrPayload : undefined,
      qrToken: holder ? ticket.qrToken : undefined,
      // Phase 2 (RSG-ENG-SEC-006): per-pass TOTP seed, holder-only, computed
      // on the fly so it is never persisted to the ledger file.
      totpSeed:
        holder && ticket.qrToken
          ? totpSeedForPresentation(ticket.ticketId, ticket.qrToken)
          : undefined,
      attendeePhone: holder ? ticket.attendeePhone : undefined,
    } as IssuedTicket;
  });
}
