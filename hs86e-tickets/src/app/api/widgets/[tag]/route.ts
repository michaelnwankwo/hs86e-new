import { NextResponse } from "next/server";
import { z } from "zod";
import { listEvents } from "@/services/catalog";

export const dynamic = "force-dynamic";

const tagSchema = z.enum(["next-event-countdown", "quick-ticket-pass"]);

/**
 * Public, read-only payloads for PWA home-screen widgets. These endpoints are
 * safe to cache (service worker: NetworkFirst) — they never contain user PII.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ tag: string }> },
) {
  const { tag } = await params;
  const parsed = tagSchema.safeParse(tag);
  if (!parsed.success) {
    return NextResponse.json({ error: "Unknown widget tag" }, { status: 404 });
  }

  if (parsed.data === "quick-ticket-pass") {
    return NextResponse.json({
      tag: "quick-ticket-pass",
      kind: "ticket",
      // The widget template (public/widgets or /widgets/quick-ticket-pass)
      // fills in the ACTIVE pass from the device's local/shared storage — the
      // server never exposes a specific user's QR payload.
      hint: "Show the ticket saved on this device.",
      generatedAt: new Date().toISOString(),
    });
  }

  const events = await listEvents().catch((err) => {
    console.error(`[hs86e] /api/widgets/${tag} rendered with an empty event list:`, err);
    return [];
  });
  const now = Date.now();
  const upcoming = events
    .filter((event) => {
      const start = Date.parse(event.startsAt);
      return Number.isFinite(start) && start > now;
    })
    .sort((a, b) => Date.parse(a.startsAt) - Date.parse(b.startsAt));

  const event = upcoming[0] ?? events[0] ?? null;

  return NextResponse.json({
    tag: "next-event-countdown",
    kind: "countdown",
    event: event
      ? {
          id: event.id,
          slug: event.slug,
          name: event.name,
          venue: event.venue?.name || "",
          doorsAt: event.doorsAt,
          startsAt: event.startsAt,
          image: event.image,
        }
      : null,
    generatedAt: new Date().toISOString(),
  });
}
