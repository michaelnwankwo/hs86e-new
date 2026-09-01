import { NextResponse } from "next/server";
import { z } from "zod";
import { getStaffSessionFromCookies } from "@/lib/auth";
import { isDemoMode } from "@/lib/env";
import { decodeTicketPayload, parseTicketPayload } from "@/lib/ticket-payload";
import { verifyHs86Payload } from "@/lib/ticket-token";
import { isTicketIdShape } from "@/lib/utils";
import { findTicket, updateTicketStatus } from "@/services/demo/store";
import { checkInTicket } from "@/services/wp/fooevents";
import { ticketById, ticketsForOrder, updateLedgerTicket } from "@/services/tickets/ledger";
import type { IssuedTicket, ScanValidateResponse } from "@/lib/types";
import { TRANSFER_VOID_MESSAGE, TRANSFER_VOID_STATUS } from "@/lib/constants";

const schema = z.object({
  ticketId: z.string().min(4).max(240),
  eventId: z.string().min(1),
  deviceId: z.string().min(2).max(64),
  scannedAt: z.string().datetime().optional(),
});

function passMessage(ticket: IssuedTicket, used: boolean) {
  const index = ticket.passIndex || 1;
  const total = ticket.passTotal || ticketsForOrder(ticket.orderId).length || 1;
  return used ? "TICKET ALREADY USED" : `Ticket ${index} of ${total} checked in`;
}

function resolveTicket(ticketId: string) {
  return ticketById(ticketId) || findTicket(ticketId);
}

function tokenRejected(ticket: IssuedTicket, raw: string): ScanValidateResponse | null {
  if (!ticket.qrToken) return null;
  const parsed = parseTicketPayload(raw);
  if (parsed.signed && parsed.nonce && parsed.signature) {
    if (!verifyHs86Payload(parsed.ticketId, parsed.nonce, parsed.signature)) {
      return {
        verdict: "invalid",
        ticketId: ticket.ticketId,
        message: "QR signature is not valid",
        passIndex: ticket.passIndex,
        passTotal: ticket.passTotal,
      };
    }
  }
  if (!parsed.nonce || parsed.nonce !== ticket.qrToken) {
    return {
      verdict: "transferred",
      ticketId: ticket.ticketId,
      attendeeName: ticket.attendeeName,
      tier: ticket.tier,
      eventName: ticket.eventName,
      message: TRANSFER_VOID_MESSAGE,
      statusLabel: TRANSFER_VOID_STATUS,
      passIndex: ticket.passIndex,
      passTotal: ticket.passTotal,
    };
  }
  return null;
}

export async function POST(request: Request) {
  const session = await getStaffSessionFromCookies();
  if (!session) {
    return NextResponse.json({ error: "Staff session required" }, { status: 401 });
  }

  const json = await request.json().catch(() => null);
  const parsed = schema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid scan payload" }, { status: 400 });
  }

  const raw = parsed.data.ticketId;
  const ticketId = decodeTicketPayload(raw);
  if (!ticketId || !isTicketIdShape(ticketId)) {
    return NextResponse.json({ error: "Invalid scan payload" }, { status: 400 });
  }

  const { eventId, deviceId, scannedAt } = parsed.data;
  const when = scannedAt || new Date().toISOString();

  const local = resolveTicket(ticketId);

  if (local) {
    const revoked = tokenRejected(local, raw);
    if (revoked) return NextResponse.json(revoked);

    if (local.eventId && eventId && local.eventId !== eventId) {
      return NextResponse.json({
        verdict: "invalid",
        ticketId,
        attendeeName: local.attendeeName,
        tier: local.tier,
        eventName: local.eventName,
        message: "Wrong event",
        passIndex: local.passIndex,
        passTotal: local.passTotal,
      } satisfies ScanValidateResponse);
    }
    if (local.status === "Canceled" || local.status === "Unpaid") {
      return NextResponse.json({
        verdict: "canceled",
        ticketId,
        attendeeName: local.attendeeName,
        tier: local.tier,
        eventName: local.eventName,
        message: local.status === "Unpaid" ? "Ticket unpaid" : "Ticket canceled",
        passIndex: local.passIndex,
        passTotal: local.passTotal,
      } satisfies ScanValidateResponse);
    }
    if (local.status === "Checked In") {
      return NextResponse.json({
        verdict: "duplicate",
        ticketId,
        attendeeName: local.attendeeName,
        attendeeEmail: local.attendeeEmail,
        attendeePhone: local.attendeePhone,
        tier: local.tier,
        eventName: local.eventName,
        checkedInAt: local.checkedInAt,
        message: passMessage(local, true),
        passIndex: local.passIndex,
        passTotal: local.passTotal,
      } satisfies ScanValidateResponse);
    }

    updateLedgerTicket(ticketId, { status: "Checked In", checkedInAt: when });
    updateTicketStatus(ticketId, "Checked In", when);
    const siblings = ticketsForOrder(local.orderId);
    const total = local.passTotal || siblings.length || 1;
    const index = local.passIndex || 1;
    return NextResponse.json({
      verdict: "valid",
      ticketId,
      attendeeName: local.attendeeName,
      attendeeEmail: local.attendeeEmail,
      attendeePhone: local.attendeePhone,
      tier: local.tier,
      eventName: local.eventName,
      checkedInAt: when,
      message: `Ticket ${index} of ${total} checked in`,
      passIndex: index,
      passTotal: total,
    } satisfies ScanValidateResponse);
  }

  if (isDemoMode()) {
    return NextResponse.json({
      verdict: "invalid",
      ticketId,
      message: "Ticket not found",
    } satisfies ScanValidateResponse);
  }

  const result = await checkInTicket({ ticketId, eventId, deviceId, scannedAt: when });
  return NextResponse.json({
    verdict: result.verdict,
    ticketId,
    attendeeName: result.ticket?.attendeeName,
    attendeeEmail: result.ticket?.attendeeEmail,
    attendeePhone: result.ticket?.attendeePhone,
    tier: result.ticket?.tier,
    eventName: result.ticket?.eventName,
    checkedInAt: result.ticket?.checkedInAt || (result.verdict === "valid" ? when : undefined),
    message:
      result.verdict === "duplicate"
        ? "TICKET ALREADY USED"
        : result.verdict === "valid"
          ? result.message
          : result.message,
  } satisfies ScanValidateResponse);
}
