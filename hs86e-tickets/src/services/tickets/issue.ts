import { hasFooEventsAuth, hasWooCommerce } from "@/lib/env";
import { annotatePasses } from "@/lib/ticket-payload";
import { mintTicketId } from "@/lib/ticket-id";
import { mintQrNonce, signTicketPayload } from "@/lib/ticket-token";
import type { IssuedTicket } from "@/lib/types";
import { fetchTicketsForOrder } from "@/services/wp/fooevents";
import { addOrderMeta, getOrder } from "@/services/wp/woocommerce";
import { ticketsForOrder, upsertIssuedTickets } from "./ledger";

const META_KEY = "_hs86e_issued_tickets";

function parseStored(raw: unknown): IssuedTicket[] {
  if (!raw) return [];
  try {
    const value = typeof raw === "string" ? JSON.parse(raw) : raw;
    return Array.isArray(value) ? (value as IssuedTicket[]).filter((t) => t.ticketId) : [];
  } catch {
    return [];
  }
}

function sealPass(
  ticket: IssuedTicket,
  email: string,
): IssuedTicket {
  const owner = email.trim().toLowerCase();
  const qrToken = ticket.qrToken || mintQrNonce();
  const qrPayload = ticket.qrPayload || signTicketPayload(ticket.ticketId, qrToken);
  return {
    ...ticket,
    purchaserEmail: ticket.purchaserEmail || owner,
    assignedEmail: ticket.assignedEmail || owner,
    qrToken,
    qrPayload,
  };
}

export function mintPassBatch(input: {
  quantity: number;
  orderId: number;
  orderKey: string;
  name: string;
  email: string;
  phone: string;
  eventId: string;
  eventName: string;
  eventSlug: string;
  venueName: string;
  startsAt: string;
  tier: string;
}): IssuedTicket[] {
  const qty = Math.max(1, Math.min(10, input.quantity));
  const email = input.email.trim().toLowerCase();
  return annotatePasses(
    Array.from({ length: qty }, (_, index) => {
      const ticketId = mintTicketId(input.orderId, index, input.orderKey);
      const qrToken = mintQrNonce();
      return sealPass(
        {
          ticketId,
          attendeeName: input.name,
          attendeeEmail: email,
          attendeePhone: input.phone,
          tier: input.tier,
          eventId: input.eventId,
          eventName: input.eventName,
          eventSlug: input.eventSlug,
          venueName: input.venueName,
          startsAt: input.startsAt,
          status: "Not Checked In",
          orderId: input.orderId,
          orderKey: input.orderKey,
          passIndex: index + 1,
          passTotal: qty,
          purchaserEmail: email,
          assignedEmail: email,
          qrToken,
          qrPayload: signTicketPayload(ticketId, qrToken),
          holder: true,
        },
        email,
      );
    }),
  );
}

export async function ensureIssuedTickets(orderId: number): Promise<IssuedTicket[]> {
  if (hasWooCommerce()) {
    const order = await getOrder(orderId);
    const qty = Math.max(
      1,
      (order.line_items ?? []).reduce((sum, item) => sum + Number(item.quantity || 1), 0),
    );
    const name =
      [order.billing?.first_name, order.billing?.last_name].filter(Boolean).join(" ") || "Guest";
    const eventName = order.line_items?.[0]?.name || "HS86E Event";
    const email = (order.billing?.email || "").trim().toLowerCase();

    let tickets = ticketsForOrder(orderId);
    if (tickets.length === 0) {
      tickets = parseStored(order.meta_data?.find((m) => m.key === META_KEY)?.value);
    }

    if (tickets.length < qty && hasFooEventsAuth()) {
      try {
        const minted = await fetchTicketsForOrder(orderId);
        if (minted.length > tickets.length) tickets = minted;
      } catch {
        // local mint fills remaining seats
      }
    }

    if (tickets.length < qty) {
      tickets = mintPassBatch({
        quantity: qty,
        orderId,
        orderKey: order.order_key,
        name,
        email,
        phone: order.billing?.phone || "",
        eventId: "",
        eventName,
        eventSlug: "",
        venueName: "",
        startsAt: "",
        tier: "Regular",
      });
    }

    const unique = annotatePasses(tickets).slice(0, qty).map((ticket) => ({
      ...ticket,
      purchaserEmail: ticket.purchaserEmail || email || ticket.attendeeEmail,
      assignedEmail: ticket.assignedEmail || ticket.attendeeEmail || email,
    }));
    upsertIssuedTickets(unique);
    await addOrderMeta(orderId, META_KEY, JSON.stringify(unique)).catch(() => undefined);
    return unique;
  }

  return annotatePasses(ticketsForOrder(orderId));
}
