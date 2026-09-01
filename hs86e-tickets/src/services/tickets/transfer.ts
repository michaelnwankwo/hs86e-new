import { appUrl, hasWooCommerce } from "@/lib/env";
import { currentOwnerEmail, passShareUrl } from "@/lib/ticket-payload";
import { mintQrNonce, signTicketPayload } from "@/lib/ticket-token";
import type { IssuedTicket } from "@/lib/types";
import { sendTransferEmail } from "@/services/notify/transfer-mail";
import { findTicket, updateDemoTicket } from "@/services/demo/store";
import { addOrderMeta } from "@/services/wp/woocommerce";
import {
  recordTransfer,
  ticketById,
  ticketsForOrder,
  transferCountForTicket,
  upsertIssuedTickets,
} from "./ledger";

export class TransferError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

export async function transferPass(input: {
  ticketId: string;
  fromEmail: string;
  toEmail: string;
  toName?: string;
}): Promise<{ ticket: IssuedTicket; claimUrl: string; emailSent: boolean }> {
  const ticketId = input.ticketId.trim();
  const from = input.fromEmail.trim().toLowerCase();
  const to = input.toEmail.trim().toLowerCase();
  const toName = input.toName?.trim();

  if (!ticketId) throw new TransferError("Ticket ID is required.", 400);
  if (from === to) throw new TransferError("Choose a different email than the current holder.", 400);

  const ticket = ticketById(ticketId) || findTicket(ticketId);
  if (!ticket) throw new TransferError("Ticket not found.", 404);

  const owner = currentOwnerEmail(ticket);
  if (!owner || owner !== from) {
    throw new TransferError("That email does not own this pass.", 403);
  }

  if (ticket.status === "Checked In") {
    throw new TransferError("A checked-in pass cannot be transferred.", 409);
  }
  if (ticket.status === "Canceled" || ticket.status === "Unpaid") {
    throw new TransferError("This pass cannot be transferred.", 409);
  }
  if (transferCountForTicket(ticket.ticketId) >= 20) {
    throw new TransferError("This pass has reached its transfer limit.", 409);
  }

  const qrToken = mintQrNonce();
  const qrPayload = signTicketPayload(ticket.ticketId, qrToken);
  const now = new Date().toISOString();

  const updated: IssuedTicket = {
    ...ticket,
    attendeeEmail: to,
    attendeeName: toName || ticket.attendeeName,
    assignedEmail: to,
    purchaserEmail: ticket.purchaserEmail || ticket.attendeeEmail,
    qrToken,
    qrPayload,
    transferredTo: to,
    transferredFrom: from,
    transferredAt: now,
    holder: true,
  };

  upsertIssuedTickets([updated]);
  recordTransfer({ ticketId: ticket.ticketId, fromEmail: from, toEmail: to, at: now });
  updateDemoTicket(ticket.ticketId, updated);

  if (hasWooCommerce() && updated.orderId) {
    const siblings = ticketsForOrder(updated.orderId);
    await addOrderMeta(updated.orderId, "_hs86e_issued_tickets", JSON.stringify(siblings)).catch(
      () => undefined,
    );
  }

  const claimUrl = passShareUrl(updated.ticketId, appUrl());
  const mail = await sendTransferEmail({
    to,
    fromName: ticket.attendeeName,
    claimUrl,
    ticket: updated,
  });

  return { ticket: updated, claimUrl, emailSent: mail.sent };
}
