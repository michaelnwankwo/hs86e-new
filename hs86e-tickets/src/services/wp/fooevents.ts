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
  // Negation MUST be tested first: "Not Checked In" contains "checked", so
  // the positive branch below would misread fresh tickets as already used.
  if (!v || v.startsWith("not") || v === "n" || v === "no") return "Not Checked In";
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
}): Promise<{
  verdict: ScanVerdict;
  ticket?: IssuedTicket;
  message: string;
  /**
   * True when FooEvents CONFIRMED the ticket (read OK, "Not Checked In") but
   * WordPress refused the check-in WRITE with 403. The caller may then admit
   * the attendee via the local fallback ledger (see services/tickets/wp-fallback.ts).
   * Never set when the read also failed — without WP confirmation of the
   * ticket's existence, admitting it would trust an unverified ID string.
   */
  wpBlocked403?: boolean;
  /** Any authenticated FooEvents HTTP 403; the scanner may try its cached manifest. */
  wpPermissionDenied?: boolean;
}> {
  if (!hasFooEventsAuth()) {
    // Distinct from a wrong password: nothing was even attempted. Throwing
    // makes /api/scan/validate answer 503 so the gate queues scans against
    // the offline manifest instead of rejecting attendees.
    console.error(
      "[hs86e] FooEvents credentials are NOT configured — set WP_BASE_URL, " +
        "WP_APP_USER (login slug, e.g. hs86e-scanner) and WP_APP_PASSWORD " +
        "(Users → Profile → Application Passwords) in the Netlify environment.",
    );
    throw new Error("FooEvents credentials are not configured");
  }
  // Set only when WordPress CONFIRMED the ticket exists and is unused, so the
  // 403 handler below never admits a ticket FooEvents refused to describe.
  let wpConfirmedUnused = false;
  let current: IssuedTicket | undefined;
  try {
    const existing = await postFoo<unknown>("/get_single_ticket", {
      ticket_id: input.ticketId,
      ID: input.ticketId,
    });
    const row = asTicketList(existing)[0] || (existing as FooTicket);
    current = row ? mapTicket(row, { ticketId: input.ticketId, eventId: input.eventId }) : undefined;
    if (current && input.eventId && current.eventId && current.eventId !== input.eventId) {
      return { verdict: "invalid", ticket: current, message: "Wrong event" };
    }
    if (current?.status === "Canceled" || current?.status === "Unpaid") {
      return { verdict: "canceled", ticket: current, message: "Ticket canceled" };
    }
    if (current?.status === "Checked In") {
      return { verdict: "duplicate", ticket: current, message: "Already checked in" };
    }
    // WP must have returned the ticket's OWN id — an empty/"not found" reply
    // must not count as confirmation (row can be a truthy empty array).
    wpConfirmedUnused =
      !!current &&
      !!pick(row as FooTicket, "WooCommerceEventsTicketID", "ticket_id", "ticketID", "ID") &&
      current.status === "Not Checked In";
  } catch (precheckError) {
    const precheckStatus = Number((precheckError as { status?: number })?.status ?? 0);
    const precheckDetail = precheckError instanceof Error ? precheckError.message : String(precheckError);
    console.warn(
      `[hs86e] FooEvents get_single_ticket pre-check failed (HTTP ${precheckStatus || "network"}): ` +
        `${precheckDetail.slice(0, 300)}. Ticket is not WP-confirmed; any 403 fallback must use the trusted local manifest.`,
    );
    // Continue to write — some installs reject get_single_ticket but accept update.
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
  } catch (first) {
    try {
      const data = await postFoo<unknown>("/update_ticket_status_m", {
        ticket_id: input.ticketId,
        status: "C",
        event_id: input.eventId,
      });
      return interpretCheckin(data, input.ticketId);
    } catch (second) {
      // Classify the failure so the gate gets actionable feedback:
      //  - 401/403: WordPress rejected the Application Password → credential fix
      //  - anything else (5xx, timeouts, missing endpoints): infrastructure
      //    outage → throw, so /api/scan/validate answers 503 and the scanner
      //    queues the scan against the offline manifest instead of dead-ending.
      const status = Number(
        (first as { status?: number })?.status ?? (second as { status?: number })?.status ?? 0,
      );
      if (status === 401 || status === 403) {
        const detail = second instanceof Error ? second.message : String(second);
        // WordPress tells the three failure modes apart — surface them:
        //  invalid_username      → WP_APP_USER is not the login slug
        //  incorrect_password    → Application Password wrong/revoked/expired
        //  rest_forbidden (403)  → user lacks write rights for FooEvents
        const unknownUser = /invalid_username|unknown username/i.test(detail);
        const badPassword = /incorrect_password|invalid application password/i.test(detail);
        const forbidden = status === 403 || /rest_forbidden/i.test(detail);
        console.error(
          `[hs86e] FooEvents auth rejected (HTTP ${status}). WordPress said: ${detail}. ` +
            (forbidden
              ? "PERMISSION FIX: FooEvents restricts check-ins to Administrators by default. " +
                "Either set the WP_APP_USER account to Administrator, or keep its role and grant the " +
                "'app_event_magic_tickets' capabilities (User Role Editor → filter 'event_magic_ticket'). "
              : "Netlify env: WP_BASE_URL, WP_APP_USER (login slug), WP_APP_PASSWORD " +
                "(Application Password). "),
        );
        // RSG capability-bypass fallback: WordPress authenticated the request
        // (403, not 401) and FooEvents CONFIRMED this exact ticket exists and
        // is unused — only the plugin's capability check blocked the write.
        // Admit via the local ledger and queue the WP write for later sync
        // instead of turning a misconfigured capability into a closed gate.
        if (forbidden && wpConfirmedUnused) {
          console.warn(
            `[hs86e] Admitting ${input.ticketId} via LOCAL FALLBACK — WordPress refused the ` +
              "check-in write (403) after confirming the ticket. Grant the app_event_magic_tickets " +
              "capabilities (or the functions.php user_has_cap snippet), then POST /api/scan/wp-sync " +
              "to push pending local check-ins to FooEvents.",
          );
          return {
            verdict: "valid" as const,
            ticket: current,
            message:
              "Checked in locally — WordPress blocked the write (403 capability). " +
              "Scan queued for WordPress sync.",
            wpBlocked403: true,
            wpPermissionDenied: true,
          };
        }
        return {
          verdict: "invalid" as const,
          message: unknownUser
            ? "WordPress does not recognize WP_APP_USER. Use the login slug (hs86e-scanner), not an email or display name."
            : badPassword
              ? "WordPress rejected WP_APP_PASSWORD. Regenerate the hs86e-scanner Application Password and update Netlify."
              : forbidden
                ? "WordPress refused the check-in (403). FooEvents allows Administrator only by default — make hs86e-scanner an Administrator, or grant its role the app_event_magic_tickets capabilities."
                : "FooEvents check-in failed. Confirm the hs86e-scanner Application Password.",
          wpPermissionDenied: forbidden ? true : undefined,
        };
      }
      console.error(
        `[hs86e] FooEvents check-in unavailable (HTTP ${status || "network"}). ` +
          "Falling back to 503 so the scanner queues this scan. " +
          `Detail: ${second instanceof Error ? second.message : String(second)}`,
      );
      throw new Error("FooEvents check-in unavailable");
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
