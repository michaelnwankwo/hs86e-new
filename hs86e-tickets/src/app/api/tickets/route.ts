import { NextResponse } from "next/server";
import { hasWooCommerce, isDemoMode } from "@/lib/env";
import {
  findTicket,
  findTicketsByEmail,
  findTicketsByOrderId,
} from "@/services/demo/store";
import { ensureIssuedTickets } from "@/services/tickets/issue";
import {
  presentForViewer,
  ticketById,
  ticketsByEmail,
  ticketsForOrder,
  upsertIssuedTickets,
} from "@/services/tickets/ledger";
import { listCompletedOrderIdsByEmail } from "@/services/wp/woocommerce";
import type { IssuedTicket } from "@/lib/types";

export const dynamic = "force-dynamic";

function uniqueTickets(tickets: IssuedTicket[]) {
  const map = new Map<string, IssuedTicket>();
  for (const ticket of tickets) {
    if (ticket.ticketId) map.set(ticket.ticketId, ticket);
  }
  return [...map.values()];
}

export async function GET(request: Request) {
  try {
    return await handleGet(request);
  } catch (err) {
    console.error("[hs86e] /api/tickets recovered from unexpected failure:", err);
    return NextResponse.json(
      { error: "Ticket lookup is temporarily unavailable", tickets: [] },
      { status: 503 },
    );
  }
}

async function handleGet(request: Request) {
  // NOTE: the per-IP rate limit previously on this route was removed
  // (product decision) because shared/CGNAT egress IPs made 429s hit
  // legitimate buyers and freeze the wallet UI. Enumeration protection is
  // instead provided by unguessable ticket IDs and holder-scoped QR
  // redaction in presentForViewer.

  const { searchParams } = new URL(request.url);
  const ticketQuery = (
    searchParams.get("ticket") ||
    searchParams.get("ticket_id") ||
    searchParams.get("ticketId") ||
    ""
  ).trim();
  const orderRaw = (searchParams.get("order") || searchParams.get("order_id") || "").trim();
  const orderId = Number(orderRaw);
  const hasOrder = Boolean(orderRaw) && Number.isFinite(orderId) && orderId > 0;
  const email = (searchParams.get("email") || "").trim().toLowerCase();
  const key = (searchParams.get("key") || "").trim();

  if (!ticketQuery && !hasOrder && !email && !key) {
    return NextResponse.json(
      { error: "Enter a ticket ID, order ID, or email." },
      { status: 400 },
    );
  }

  const matched: IssuedTicket[] = [];

  if (ticketQuery) {
    const hit = ticketById(ticketQuery) || findTicket(ticketQuery);
    if (hit) matched.push(hit);
  }

  if (hasOrder) {
    matched.push(...ticketsForOrder(orderId));
    matched.push(...findTicketsByOrderId(orderId));
    if (isDemoMode()) {
      const demo = findTicketsByOrderId(orderId);
      matched.push(...demo);
    } else if (hasWooCommerce()) {
      try {
        const issued = await ensureIssuedTickets(orderId);
        matched.push(...issued);
      } catch {
        // ledger / demo already considered
      }
    }
  }

  if (email) {
    matched.push(...ticketsByEmail(email));
    matched.push(...findTicketsByEmail(email));
    if (!isDemoMode() && hasWooCommerce()) {
      try {
        const ids = await listCompletedOrderIdsByEmail(email);
        for (const id of ids) {
          matched.push(...(await ensureIssuedTickets(id)));
        }
      } catch {
        // email ledger is enough
      }
    }
  }

  if (key && hasOrder) {
    matched.push(...ticketsForOrder(orderId, key));
  }

  const tickets = uniqueTickets(matched);
  if (tickets.length > 0) {
    upsertIssuedTickets(tickets);
    const presented = presentForViewer(tickets, email, { revealQr: Boolean(ticketQuery) && !email });
    return NextResponse.json({ status: "completed", tickets: presented, issuing: false });
  }

  return NextResponse.json(
    { error: "No tickets matched that lookup.", tickets: [], issuing: false },
    { status: 404 },
  );
}
