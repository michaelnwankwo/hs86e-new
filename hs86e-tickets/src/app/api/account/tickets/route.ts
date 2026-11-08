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
import { listOrdersForCustomer } from "@/services/wp/woocommerce";
import type { IssuedTicket } from "@/lib/types";

export const dynamic = "force-dynamic";

/**
 * Tickets for the *signed-in* account only.
 *
 * Sources (never an email supplied by the caller):
 *  1. WooCommerce orders whose `customer` equals the authenticated WP user ID
 *     from the hs86e_customer_session cookie — tickets are then issued/loaded
 *     per order (FooEvents -> ledger -> local mint, same as checkout).
 *  2. The local issued-ticket ledger, matched against the *session's own*
 *     identity (purchaser/assigned email on the verified session, or the
 *     order IDs above). This catches passes minted at webhook time for
 *     orders placed on this storefront.
 *
 * QR payload/token/TOTP seed are only ever returned for passes the viewer
 * currently holds (presentForViewer with the session identity).
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

  // Session context only — both derived from the verified cookie session.
  const viewerEmail = session.user.email.trim().toLowerCase();
  const userId = Number(session.user.id);

  const found = new Map<string, IssuedTicket>();
  const orderIds = new Set<number>();

  // 1) WooCommerce orders for the authenticated customer ID.
  if (hasWooCommerce() && Number.isSafeInteger(userId) && userId > 0) {
    try {
      const orders = await listOrdersForCustomer(userId, 25);
      for (const order of orders) {
        const status = String(order.status || "").toLowerCase();
        if (status !== "completed" && status !== "processing") continue;
        const id = Number(order.id);
        if (!Number.isSafeInteger(id) || id <= 0) continue;
        orderIds.add(id);
        try {
          for (const ticket of await ensureIssuedTickets(id)) {
            if (ticket.ticketId) found.set(ticket.ticketId, ticket);
          }
        } catch (err) {
          console.error(`[hs86e] /api/account/tickets: issuing for order ${id} failed:`, err);
        }
      }
    } catch (err) {
      console.error("[hs86e] /api/account/tickets: WooCommerce order lookup failed:", err);
    }
  }

  // 2) Local ledger — passes the session identity purchased or currently holds.
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

  // Redact for a signed-in viewer: orderKey stripped, QR only for current holders.
  const presented = presentForViewer(tickets, viewerEmail);

  return NextResponse.json(
    { status: "ok", count: presented.length, tickets: presented },
    { headers: noStoreHeaders() },
  );
}
