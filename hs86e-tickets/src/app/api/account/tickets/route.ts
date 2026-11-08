import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import {
  callWordPressCustomer,
  CUSTOMER_SESSION_COOKIE,
  noStoreHeaders,
  parseAccountSession,
} from "@/lib/customer-account-proxy";
import { hasWooCommerce } from "@/lib/env";
import { ensureIssuedTickets } from "@/services/tickets/issue";
import { allLedgerTickets, presentForViewer, upsertIssuedTickets } from "@/services/tickets/ledger";
import { listOrdersForBillingEmail, listOrdersForCustomer, type WcOrderSummary } from "@/services/wp/woocommerce";
import type { IssuedTicket } from "@/lib/types";

export const dynamic = "force-dynamic";
export const revalidate = 0;

/**
 * Tickets for the *signed-in* account only.
 *  1. WooCommerce orders with `customer` = authenticated WP user ID.
 *  2. WooCommerce orders with `billing.email` = the session's own verified
 *     email (guest checkout, Customer: Guest). Hard-filtered server-side.
 *  3. Local issued-ticket ledger, matched against the session identity.
 */
export async function GET() {
  const jar = await cookies();
  const token = jar.get(CUSTOMER_SESSION_COOKIE)?.value;
  if (!token) {
    return NextResponse.json({ error: "Sign in required" }, { status: 401, headers: noStoreHeaders() });
  }

  let upstream: unknown;
  try {
    upstream = await callWordPressCustomer("session", {
      method: "GET",
      headers: { Authorization: `Bearer ${token}` },
    });
  } catch (error) {
    const status = (error as { status?: number })?.status;
    if (status === 401) {
      return NextResponse.json({ error: "Session expired" }, { status: 401, headers: noStoreHeaders() });
    }
    return NextResponse.json(
      { error: "Account service is temporarily unavailable" },
      { status: 503, headers: noStoreHeaders() },
    );
  }

  const session = parseAccountSession(upstream);
  if (!session) {
    return NextResponse.json(
      { error: "Account service returned invalid profile data" },
      { status: 502, headers: noStoreHeaders() },
    );
  }

  // Session context only.
  const viewerEmail = session.user.email.trim().toLowerCase();
  const userId = Number(session.user.id);

  const found = new Map<string, IssuedTicket>();
  const orderIds = new Set<number>();

  async function collectFromOrders(orders: WcOrderSummary[]) {
    for (const order of orders) {
      const status = String(order.status || "").toLowerCase();
      if (status !== "completed" && status !== "processing") continue;
      const id = Number(order.id);
      if (!Number.isSafeInteger(id) || id <= 0) continue;
      if (orderIds.has(id)) continue;
      orderIds.add(id);
      try {
        for (const ticket of await ensureIssuedTickets(id)) {
          if (ticket.ticketId) found.set(ticket.ticketId, ticket);
        }
      } catch (err) {
        console.error(`[hs86e] /api/account/tickets: issuing for order ${id} failed:`, err);
      }
    }
  }

  if (hasWooCommerce()) {
    if (Number.isSafeInteger(userId) && userId > 0) {
      try {
        await collectFromOrders(await listOrdersForCustomer(userId, 25));
      } catch (err) {
        console.error("[hs86e] /api/account/tickets: WooCommerce customer lookup failed:", err);
      }
    }
    try {
      await collectFromOrders(await listOrdersForBillingEmail(viewerEmail, 25));
    } catch (err) {
      console.error("[hs86e] /api/account/tickets: WooCommerce billing-email lookup failed:", err);
    }
  }

  for (const ticket of allLedgerTickets()) {
    if (!ticket.ticketId) continue;
    const purchaser = String(ticket.purchaserEmail || ticket.attendeeEmail || "").trim().toLowerCase();
    const assigned = String(ticket.assignedEmail || ticket.attendeeEmail || "").trim().toLowerCase();
    const ownOrder = orderIds.has(Number(ticket.orderId));
    if (ownOrder || purchaser === viewerEmail || assigned === viewerEmail) {
      if (!found.has(ticket.ticketId)) found.set(ticket.ticketId, ticket);
    }
  }

  const tickets = [...found.values()].sort((a, b) => {
    const byOrder = (b.orderId || 0) - (a.orderId || 0);
    if (byOrder !== 0) return byOrder;
    return (a.passIndex || 1) - (b.passIndex || 1);
  });
  if (tickets.length > 0) upsertIssuedTickets(tickets);

  const presented = presentForViewer(tickets, viewerEmail);

  return NextResponse.json(
    { status: "ok", count: presented.length, tickets: presented },
    { headers: noStoreHeaders() },
  );
}