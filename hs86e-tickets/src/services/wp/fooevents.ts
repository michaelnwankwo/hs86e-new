import type { IssuedTicket, ManifestAttendee, ScanVerdict, TicketStatus } from "@/lib/types";
import { hasFooEventsAuth } from "@/lib/env";
import { fooEventsClient } from "./client";
import { getOrder } from "./woocommerce";

interface FooTicket {
  ID?: number | string;
  id?: number | string;
  ticket_id?: string;
  WooCommerceEventsTicketID?: string;
  attendee_name?: string;
  WooCommerceEventsAttendeeName?: string;
  attendee_email?: string;
  WooCommerceEventsAttendeeEmail?: string;
  attendee_telephone?: string;
  WooCommerceEventsAttendeeTelephone?: string;
  status?: string;
  WooCommerceEventsStatus?: string;
  product_id?: string | number;
  WooCommerceEventsProductID?: string | number;
  event_id?: string | number;
  order_id?: string | number;
  WooCommerceEventsOrderID?: string | number;
  event_name?: string;
  ticket_type?: string;
  variation?: string;
  checked_in?: string;
  [key: string]: unknown;
}

function pick(ticket: FooTicket, ...keys: string[]) {
  for (const key of keys) {
    const value = ticket[key];
    if (value !== undefined && value !== null && String(value).length > 0) return String(value);
  }
  return "";
}

function normalizeStatus(raw: string): TicketStatus {
  const v = raw.toLowerCase();
  if (v.includes("cancel") || v.includes("refund") || v === "unpaid" || v === "u") {
    if (v.includes("unpaid") || v === "u") return "Unpaid";
    return "Canceled";
  }
  if (v.includes("checked") || v === "c" || v === "yes") return "Checked In";
  return "Not Checked In";
}

function mapTicket(raw: FooTicket, fallback?: Partial<IssuedTicket>): IssuedTicket {
  const status = normalizeStatus(pick(raw, "WooCommerceEventsStatus", "status") || "Not Checked In");
  return {
    ticketId:
      pick(raw, "WooCommerceEventsTicketID", "ticket_id", "ticketID", "ID") || fallback?.ticketId || "",
    attendeeName:
      pick(raw, "WooCommerceEventsAttendeeName", "attendee_name", "name") ||
      fallback?.attendeeName ||
      "Guest",
    attendeeEmail:
      pick(raw, "WooCommerceEventsAttendeeEmail", "attendee_email", "email") ||
      fallback?.attendeeEmail ||
      "",
    attendeePhone:
      pick(raw, "WooCommerceEventsAttendeeTelephone", "attendee_telephone", "telephone") ||
      fallback?.attendeePhone ||
      "",
    tier: pick(raw, "ticket_type", "variation", "WooCommerceEventsVariationName") || fallback?.tier || "Regular",
    eventId:
      pick(raw, "WooCommerceEventsProductID", "product_id", "event_id") || fallback?.eventId || "",
    eventName: pick(raw, "event_name", "post_title") || fallback?.eventName || "HS86E Event",
    eventSlug: fallback?.eventSlug || "",
    venueName: fallback?.venueName || "",
    startsAt: fallback?.startsAt || "",
    status,
    checkedInAt: pick(raw, "checked_in", "WooCommerceEventsCheckedInTime") || fallback?.checkedInAt,
    orderId: Number(pick(raw, "WooCommerceEventsOrderID", "order_id") || fallback?.orderId || 0),
    orderKey: fallback?.orderKey || "",
  };
}

function asTicketList(data: unknown): FooTicket[] {
  if (Array.isArray(data)) return data as FooTicket[];
  if (data && typeof data === "object") {
    const rec = data as Record<string, unknown>;
    for (const key of ["tickets", "data", "output", "result"]) {
      if (Array.isArray(rec[key])) return rec[key] as FooTicket[];
    }
  }
  return [];
}

async function postFoo<T>(path: string, body: Record<string, unknown>) {
  const client = fooEventsClient();
  const { data } = await client.post<T>(path, body);
  return data;
}

export async function fetchTicketsForOrder(orderId: number): Promise<IssuedTicket[]> {
  if (!hasFooEventsAuth()) return [];
  const order = await getOrder(orderId);
  const email = order.billing?.email || "";
  const name = [order.billing?.first_name, order.billing?.last_name].filter(Boolean).join(" ");
  const fallback = {
    attendeeEmail: email,
    attendeeName: name,
    attendeePhone: order.billing?.phone,
    orderId,
    orderKey: order.order_key,
  };

  const productIds = new Set<string>();
  try {
    const events = await postFoo<unknown>("/get_list_of_events", {});
    const list = asTicketList(events);
    list.forEach((row) => {
      const id = pick(row, "ID", "id", "event_id");
      if (id) productIds.add(id);
    });
  } catch {
    productIds.add("129");
  }

  if (productIds.size === 0) productIds.add("129");

  const tickets: IssuedTicket[] = [];
  for (const eventId of productIds) {
    try {
      const data = await postFoo<unknown>("/get_tickets_in_event", { event_id: eventId });
      const list = asTicketList(data);
      for (const row of list) {
        const mapped = mapTicket(row, { ...fallback, eventId });
        if (mapped.orderId === orderId || pick(row, "order_id", "WooCommerceEventsOrderID") === String(orderId)) {
          tickets.push(mapped);
        }
      }
    } catch {
      // try next event
    }
  }

  return tickets.filter((t) => t.ticketId);
}

export async function fetchAttendeeManifest(eventId: string): Promise<ManifestAttendee[]> {
  try {
    const data = await postFoo<unknown>("/get_tickets_in_event", { event_id: eventId });
    return asTicketList(data)
      .map((row) => mapTicket(row, { eventId }))
      .filter((t) => t.ticketId)
      .map((t) => ({
        ticketId: t.ticketId,
        attendeeName: t.attendeeName,
        attendeeEmail: t.attendeeEmail,
        attendeePhone: t.attendeePhone,
        tier: t.tier,
        eventId: t.eventId || eventId,
        eventName: t.eventName,
        status: t.status,
        checkedInAt: t.checkedInAt,
      }));
  } catch {
    return [];
  }
}

export async function checkInTicket(input: {
  ticketId: string;
  eventId?: string;
  deviceId?: string;
  scannedAt?: string;
}): Promise<{ verdict: ScanVerdict; ticket?: IssuedTicket; message: string }> {
  try {
    const existing = await postFoo<unknown>("/get_single_ticket", {
      ticket_id: input.ticketId,
      ID: input.ticketId,
    });
    const row = asTicketList(existing)[0] || (existing as FooTicket);
    const current = row ? mapTicket(row, { ticketId: input.ticketId, eventId: input.eventId }) : undefined;
    if (current && input.eventId && current.eventId && current.eventId !== input.eventId) {
      return { verdict: "invalid", ticket: current, message: "Wrong event" };
    }
    if (current?.status === "Canceled" || current?.status === "Unpaid") {
      return { verdict: "canceled", ticket: current, message: "Ticket canceled" };
    }
    if (current?.status === "Checked In") {
      return { verdict: "duplicate", ticket: current, message: "Already checked in" };
    }
  } catch {
    // continue to write — some installs reject get_single_ticket but accept update
  }

  try {
    const data = await postFoo<unknown>("/update_ticket_status", {
      ticket_id: input.ticketId,
      ID: input.ticketId,
      status: "Checked In",
      event_id: input.eventId,
      device_id: input.deviceId,
      timestamp: input.scannedAt,
    });
    return interpretCheckin(data, input.ticketId);
  } catch {
    try {
      const data = await postFoo<unknown>("/update_ticket_status_m", {
        ticket_id: input.ticketId,
        status: "C",
        event_id: input.eventId,
      });
      return interpretCheckin(data, input.ticketId);
    } catch {
      return {
        verdict: "invalid",
        message: "FooEvents check-in failed. Confirm the hs86e-scanner Application Password.",
      };
    }
  }
}

function interpretCheckin(data: unknown, ticketId: string) {
  const payload = (data ?? {}) as Record<string, unknown>;
  const status = String(
    payload.status || payload.verdict || payload.result || payload.message || payload.output || "",
  ).toLowerCase();
  const ticket = payload.ticket
    ? mapTicket(payload.ticket as FooTicket, { ticketId })
    : undefined;

  if (status.includes("already") || status.includes("duplicate")) {
    return { verdict: "duplicate" as const, ticket, message: "Already checked in" };
  }
  if (status.includes("cancel") || status.includes("refund")) {
    return { verdict: "canceled" as const, ticket, message: "Ticket canceled" };
  }
  if (status.includes("not found") || status.includes("invalid") || status.includes("missing")) {
    return { verdict: "invalid" as const, ticket, message: "Ticket not valid for this event" };
  }
  if (payload.success === false || payload.error) {
    return { verdict: "invalid" as const, ticket, message: String(payload.message || "Invalid ticket") };
  }
  return { verdict: "valid" as const, ticket, message: "Checked in" };
}
