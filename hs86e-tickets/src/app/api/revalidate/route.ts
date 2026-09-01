import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/**
 * WordPress → PWA on-demand revalidation.
 * Point a WooCommerce / product webhook (Created, Updated, Deleted) at this URL.
 * Header: x-hs86e-revalidate = REVALIDATE_SECRET
 */
export async function POST(request: Request) {
  const secret = process.env.REVALIDATE_SECRET;
  const header = request.headers.get("x-hs86e-revalidate");
  if (secret && header !== secret) {
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
