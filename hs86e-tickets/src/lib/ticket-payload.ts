import type { IssuedTicket } from "@/lib/types";

export interface ParsedTicketPayload {
  ticketId: string;
  nonce?: string;
  signature?: string;
  signed: boolean;
}

/** Unique QR payload per pass — never order-id-only or email-only. */
export function encodeTicketPayload(
  ticket: Pick<IssuedTicket, "ticketId" | "orderId" | "qrPayload">,
) {
  return ticket.qrPayload || ticket.ticketId;
}

export function parseTicketPayload(raw: string): ParsedTicketPayload {
  const value = raw.trim();
  if (!value) return { ticketId: "", signed: false };

  if (value.startsWith("HS86.")) {
    const parts = value.split(".");
    if (parts.length === 4 && parts[0] === "HS86" && parts[1] && parts[2] && parts[3]) {
      return {
        ticketId: parts[1],
        nonce: parts[2],
        signature: parts[3],
        signed: true,
      };
    }
  }

  if (value.startsWith("{")) {
    try {
      const parsed = JSON.parse(value) as {
        ticketId?: string;
        ticket_id?: string;
        id?: string;
        nonce?: string;
        n?: string;
        token?: string;
        sig?: string;
      };
      const ticketId = String(parsed.ticketId || parsed.ticket_id || parsed.id || "");
      const nonce = parsed.nonce || parsed.n || parsed.token;
      return { ticketId, nonce, signature: parsed.sig, signed: Boolean(nonce) };
    } catch {
      return { ticketId: value, signed: false };
    }
  }

  try {
    if (value.includes("ticketId=") || value.includes("ticket=")) {
      const url = value.includes("://") ? new URL(value) : new URL(value, "https://hs86e.local");
      const ticketId = url.searchParams.get("ticketId") || url.searchParams.get("ticket") || "";
      const nonce = url.searchParams.get("n") || url.searchParams.get("nonce") || undefined;
      if (ticketId) return { ticketId, nonce, signed: Boolean(nonce) };
    }
  } catch {
    // plain id
  }

  return { ticketId: value, signed: false };
}

export function decodeTicketPayload(raw: string): string {
  return parseTicketPayload(raw).ticketId;
}

export function annotatePasses(tickets: IssuedTicket[]): IssuedTicket[] {
  const total = tickets.length;
  return tickets.map((ticket, index) => ({
    ...ticket,
    passIndex: ticket.passIndex || index + 1,
    passTotal: ticket.passTotal || total,
  }));
}

export function passSharePath(ticketId: string) {
  return `/tickets?ticketId=${encodeURIComponent(ticketId)}`;
}

export function passShareUrl(ticketId: string, origin?: string) {
  const base = (origin || "").replace(/\/$/, "");
  return `${base}${passSharePath(ticketId)}`;
}

export function currentOwnerEmail(ticket: Pick<IssuedTicket, "assignedEmail" | "attendeeEmail">) {
  return (ticket.assignedEmail || ticket.attendeeEmail || "").trim().toLowerCase();
}

export function purchaserOf(ticket: Pick<IssuedTicket, "purchaserEmail" | "attendeeEmail">) {
  return (ticket.purchaserEmail || ticket.attendeeEmail || "").trim().toLowerCase();
}
