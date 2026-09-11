import { NextResponse } from "next/server";
import { getStaffSessionFromCookies } from "@/lib/auth";
import { isDemoMode } from "@/lib/env";
import type { ManifestAttendee } from "@/lib/types";
import { demoManifest } from "@/services/demo/store";
import { ticketsForEvent } from "@/services/tickets/ledger";
import { fetchAttendeeManifest } from "@/services/wp/fooevents";

export const dynamic = "force-dynamic";

function asManifest(row: {
  ticketId: string;
  attendeeName: string;
  attendeeEmail: string;
  attendeePhone: string;
  tier: string;
  eventId: string;
  eventName: string;
  status: ManifestAttendee["status"];
  checkedInAt?: string;
  qrToken?: string;
}): ManifestAttendee {
  return {
    ticketId: row.ticketId,
    attendeeName: row.attendeeName,
    attendeeEmail: row.attendeeEmail,
    attendeePhone: row.attendeePhone,
    tier: row.tier,
    eventId: row.eventId,
    eventName: row.eventName,
    status: row.status,
    checkedInAt: row.checkedInAt,
    qrToken: row.qrToken,
  };
}

export async function GET(request: Request) {
  try {
    return await handleGet(request);
  } catch (err) {
    console.error("[hs86e] /api/scan/attendees recovered from unexpected failure:", err);
    return NextResponse.json(
      { error: "Attendee manifest is temporarily unavailable", attendees: [] },
      { status: 503 },
    );
  }
}

async function handleGet(request: Request) {
  const session = await getStaffSessionFromCookies();
  if (!session) {
    return NextResponse.json({ error: "Staff session required" }, { status: 401 });
  }

  const eventId = new URL(request.url).searchParams.get("event") || "";
  if (!eventId) {
    return NextResponse.json({ error: "event is required" }, { status: 400 });
  }

  const map = new Map<string, ManifestAttendee>();

  if (isDemoMode()) {
    for (const row of demoManifest(eventId)) map.set(row.ticketId, row);
  } else {
    try {
      for (const row of await fetchAttendeeManifest(eventId)) map.set(row.ticketId, row);
    } catch {
      // ledger still used
    }
  }

  for (const ticket of ticketsForEvent(eventId)) {
    map.set(ticket.ticketId, asManifest(ticket));
  }

  return NextResponse.json({
    eventId,
    attendees: [...map.values()],
    syncedAt: new Date().toISOString(),
  });
}
