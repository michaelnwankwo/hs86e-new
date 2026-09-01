import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { currentOwnerEmail, purchaserOf } from "@/lib/ticket-payload";
import type { IssuedTicket, TicketTransferRecord } from "@/lib/types";

interface Ledger {
  tickets: IssuedTicket[];
  transfers?: TicketTransferRecord[];
}

const FILE = join(process.cwd(), ".data", "issued-tickets.json");

function load(): Ledger {
  try {
    return JSON.parse(readFileSync(FILE, "utf8")) as Ledger;
  } catch {
    return { tickets: [], transfers: [] };
  }
}

function save(ledger: Ledger) {
  mkdirSync(dirname(FILE), { recursive: true });
  writeFileSync(FILE, JSON.stringify(ledger, null, 2), "utf8");
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
    return {
      ...ticket,
      holder,
      assignedEmail: ticket.assignedEmail || ticket.attendeeEmail,
      purchaserEmail: ticket.purchaserEmail || ticket.attendeeEmail,
      transferredTo: transferredAway ? assigned : undefined,
      qrPayload: holder ? ticket.qrPayload : undefined,
      qrToken: holder ? ticket.qrToken : undefined,
    };
  });
}
