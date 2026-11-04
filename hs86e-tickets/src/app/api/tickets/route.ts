import { NextResponse } from "next/server";
import { hasWooCommerce, isDemoMode } from "@/lib/env";
import { findTicket, findTicketsByOrder } from "@/services/demo/store";
import { ensureIssuedTickets } from "@/services/tickets/issue";
import { presentForViewer, ticketById, ticketsForOrder, upsertIssuedTickets } from "@/services/tickets/ledger";
import { getOrder } from "@/services/wp/woocommerce";
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
  const { searchParams } = new URL(request.url);
  const ticketQuery = (
    searchParams.get("ticket") ||
    searchParams.get("ticket_id") ||
    searchParams.get("ticketId") ||
    ""
  ).trim();
  const orderRaw = (searchParams.get("order") || searchParams.get("order_id") || "").trim();
  const orderId = Number(orderRaw);
  const hasOrder = Boolean(orderRaw) && Number.isSafeInteger(orderId) && orderId > 0;
  const key = (searchParams.get("key") || "").trim();

  if (Boolean(ticketQuery) === hasOrder) {
    return NextResponse.json(
      { error: "Enter either a Ticket ID or an Order ID." },
      { status: 400 },
    );
  }
  if (hasOrder && !key) {
    return NextResponse.json(
      { error: "An Order ID lookup requires the checkout order key." },
      { status: 400 },
    );
  }

  const matched: IssuedTicket[] = [];
  if (ticketQuery) {
    const hit = ticketById(ticketQuery) || findTicket(ticketQuery);
    if (hit) matched.push(hit);
  }

  if (hasOrder) {
    // Local order data is only disclosed when the caller proves possession of
    // the unguessable order key. The order number alone is not authorization.
    matched.push(...ticketsForOrder(orderId, key));
    if (isDemoMode()) {
      const demoOrder = findTicketsByOrder(orderId, key);
      if (demoOrder?.status === "completed") matched.push(...demoOrder.tickets);
    } else if (hasWooCommerce()) {
      try {
        const order = await getOrder(orderId);
        if (
          String(order.order_key || "") === key &&
          String(order.status || "").toLowerCase() === "completed"
        ) {
          matched.push(...(await ensureIssuedTickets(orderId)));
        }
      } catch {
        // A keyed local ledger match, if any, remains available.
      }
    }
  }

  const tickets = uniqueTickets(matched);
  if (tickets.length > 0) {
    upsertIssuedTickets(tickets);
    const presented = presentForViewer(tickets, undefined, { revealQr: true });
    return NextResponse.json({ status: "completed", tickets: presented, issuing: false });
  }

  return NextResponse.json(
    { error: "No tickets matched that lookup.", tickets: [], issuing: false },
    { status: 404 },
  );
}
