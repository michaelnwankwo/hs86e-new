import { timingSafeEqual } from "node:crypto";
import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { REVALIDATE_RATE_MAX, REVALIDATE_RATE_WINDOW_MS } from "@/lib/constants";
import { clientIp, rateLimit } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

/**
 * WordPress → PWA on-demand revalidation.
 * Point a WooCommerce / product webhook (Created, Updated, Deleted) at this URL.
 * Header: x-hs86e-revalidate = REVALIDATE_SECRET
 */

function secretMatches(provided: string | null, expected: string) {
  if (!provided) return false;
  const left = Buffer.from(provided);
  const right = Buffer.from(expected);
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}

export async function POST(request: Request) {
  const ip = clientIp(request);
  const limited = rateLimit(`revalidate:${ip}`, REVALIDATE_RATE_MAX, REVALIDATE_RATE_WINDOW_MS);
  if (!limited.ok) {
    return NextResponse.json(
      { error: "Too many revalidate requests. Wait and try again." },
      { status: 429 },
    );
  }

  // Fail closed: a shared secret MUST be configured before the endpoint
  // accepts cache-flush requests from the public internet.
  const secret = process.env.REVALIDATE_SECRET;
  if (!secret) {
    return NextResponse.json(
      { error: "REVALIDATE_SECRET is not configured on the server." },
      { status: 503 },
    );
  }

  const header = request.headers.get("x-hs86e-revalidate");
  if (!secretMatches(header, secret)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  revalidatePath("/events");
  revalidatePath("/events/[slug]", "page");
  revalidatePath("/api/events");

  return NextResponse.json({ revalidated: true, at: new Date().toISOString() });
}

export async function GET() {
  return NextResponse.json({
    ok: true,
    hint: "POST product webhooks here so new WordPress events appear on /events immediately.",
  });
}
