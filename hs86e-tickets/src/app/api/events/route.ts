import { NextResponse } from "next/server";
import { listEventsResult } from "@/services/catalog";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  try {
    const catalog = await listEventsResult();
    return NextResponse.json(
      {
        source: catalog.source,
        count: catalog.events.length,
        error: catalog.error ?? null,
        events: catalog.events,
      },
      {
        headers: {
          "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
        },
      },
    );
  } catch (err) {
    console.error("[hs86e] /api/events recovered from unexpected failure:", err);
    return NextResponse.json(
      { source: "wordpress", count: 0, error: "Events are temporarily unavailable", events: [] },
      { status: 200, headers: { "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0" } },
    );
  }
}
