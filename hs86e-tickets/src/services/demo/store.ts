import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { randomId } from "@/lib/utils";
import type { IssuedTicket, ManifestAttendee, TicketStatus } from "@/lib/types";
import { DEMO_EVENTS, findDemoEvent } from "./catalog";
import { upsertIssuedTickets } from "@/services/tickets/ledger";
import { mintPassBatch } from "@/services/tickets/issue";

export interface DemoOrder {
  id: number;
  orderKey: string;
  status: "pending" | "completed" | "cancelled";
  email: string;
  name: string;
  phone: string;
  eventId: string;
  eventSlug: string;
  variationId: string;
  quantity: number;
  amount: number;
  currency: string;
  gateway: "stripe" | "flutterwave";
  processedEventIds: string[];
  tickets: IssuedTicket[];
  createdAt: string;
}

interface DemoState {
  nextOrderId: number;
  orders: DemoOrder[];
}

const FILE = join(process.cwd(), ".data", "demo-store.json");

/**
 * In-memory mirror of the demo store. Serverless filesystems (e.g. Netlify
 * Functions) are read-only outside /tmp, so disk persistence can fail at
 * runtime; the mirror keeps demo checkout flowing for the life of the
 * instance, while hosts with writable disks keep full durability as before.
 */
let memory: DemoState | null = null;
let warnedPersist = false;

function emptyState(): DemoState {
  return { nextOrderId: 86001, orders: [] };
}

function load(): DemoState {
  try {
    const raw = readFileSync(FILE, "utf8");
    memory = JSON.parse(raw) as DemoState;
  } catch {
    if (!memory) memory = emptyState();
  }
  return memory;
}

function save(state: DemoState) {
  memory = state;
  try {
    mkdirSync(dirname(FILE), { recursive: true });
    writeFileSync(FILE, JSON.stringify(state, null, 2), "utf8");
  } catch (err) {
    if (!warnedPersist) {
      warnedPersist = true;
      console.warn(
        "[hs86e] Demo store directory is not writable on this host — keeping demo orders in memory only.",
        err,
      );
    }
  }
}

export function createDemoOrder(input: {
  email: string;
  name: string;
  phone: string;
  eventSlug: string;
  variationId: string;
  quantity: number;
  gateway: "stripe" | "flutterwave";
}): DemoOrder {
  const event = findDemoEvent(input.eventSlug);
  if (!event) throw new Error("Event not found");
  const variation = event.variations.find((v) => v.id === input.variationId);
  if (!variation) throw new Error("Ticket tier not found");
  const qty = Math.max(1, Math.min(10, input.quantity));

  const state = load();
  const order: DemoOrder = {
    id: state.nextOrderId,
    orderKey: randomId("ok"),
    status: "pending",
    email: input.email.toLowerCase(),
    name: input.name,
    phone: input.phone,
    eventId: event.id,
    eventSlug: event.slug,
    variationId: variation.id,
    quantity: qty,
    amount: variation.price * qty,
    currency: variation.currency,
    gateway: input.gateway,
    processedEventIds: [],
    tickets: [],
    createdAt: new Date().toISOString(),
  };
  state.nextOrderId += 1;
  state.orders.push(order);
  save(state);
  return order;
}

export function getDemoOrder(id: number) {
  return load().orders.find((o) => o.id === id) ?? null;
}

export function getDemoOrderByKey(id: number, key: string) {
  const order = getDemoOrder(id);
  if (!order || order.orderKey !== key) return null;
  return order;
}

export function completeDemoOrder(orderId: number, gatewayEventId?: string) {
  const state = load();
  const order = state.orders.find((o) => o.id === orderId);
  if (!order) return null;
  if (gatewayEventId && order.processedEventIds.includes(gatewayEventId)) {
    return order;
  }
  if (gatewayEventId) order.processedEventIds.push(gatewayEventId);

  if (order.status !== "completed") {
    const event = findDemoEvent(order.eventSlug) ?? DEMO_EVENTS[0];
    const variation = event.variations.find((v) => v.id === order.variationId);
    const tickets: IssuedTicket[] = mintPassBatch({
      quantity: order.quantity,
      orderId: order.id,
      orderKey: order.orderKey,
      name: order.name,
      email: order.email,
      phone: order.phone,
      eventId: event.id,
      eventName: event.name,
      eventSlug: event.slug,
      venueName: event.venue.name,
      startsAt: event.startsAt,
      tier: variation?.tier ?? "Regular",
    });
    order.tickets = tickets;
    order.status = "completed";
    upsertIssuedTickets(tickets);
  }
  save(state);
  return order;
}

export function findTicketsByOrder(orderId: number, emailOrKey: string) {
  const order = getDemoOrder(orderId);
  if (!order) return null;
  const token = emailOrKey.trim().toLowerCase();
  const ok = order.orderKey.toLowerCase() === token || order.email.toLowerCase() === token;
  if (!ok) return null;
  return order;
}

export function allDemoTickets(): IssuedTicket[] {
  return load().orders.flatMap((o) => o.tickets);
}

export function findTicketsByEmail(email: string) {
  const token = email.trim().toLowerCase();
  if (!token) return [];
  return allDemoTickets().filter((ticket) => {
    const assigned = (ticket.assignedEmail || ticket.attendeeEmail || "").toLowerCase();
    const purchaser = (ticket.purchaserEmail || "").toLowerCase();
    return (
      assigned === token ||
      purchaser === token ||
      ticket.attendeeEmail.toLowerCase() === token
    );
  });
}

export function findTicketsByOrderId(orderId: number) {
  const order = getDemoOrder(orderId);
  if (!order || order.status !== "completed") return [];
  return order.tickets;
}

export function findTicket(ticketId: string) {
  return allDemoTickets().find((t) => t.ticketId === ticketId) ?? null;
}

export function updateTicketStatus(
  ticketId: string,
  status: TicketStatus,
  checkedInAt?: string,
) {
  return updateDemoTicket(ticketId, {
    status,
    ...(checkedInAt ? { checkedInAt } : {}),
  });
}

export function updateDemoTicket(ticketId: string, patch: Partial<IssuedTicket>) {
  const state = load();
  for (const order of state.orders) {
    const ticket = order.tickets.find((t) => t.ticketId === ticketId);
    if (ticket) {
      Object.assign(ticket, patch);
      save(state);
      upsertIssuedTickets([ticket]);
      return ticket;
    }
  }
  return null;
}

export function demoManifest(eventId?: string): ManifestAttendee[] {
  return allDemoTickets()
    .filter((t) => !eventId || t.eventId === eventId)
    .map((t) => ({
      ticketId: t.ticketId,
      attendeeName: t.attendeeName,
      attendeeEmail: t.attendeeEmail,
      attendeePhone: t.attendeePhone,
      tier: t.tier,
      eventId: t.eventId,
      eventName: t.eventName,
      status: t.status,
      checkedInAt: t.checkedInAt,
      qrToken: t.qrToken,
    }));
}

export function seedDemoCheckedTicket() {
  return allDemoTickets()[0] ?? null;
}
