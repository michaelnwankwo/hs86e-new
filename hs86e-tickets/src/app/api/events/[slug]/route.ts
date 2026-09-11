import { NextResponse } from "next/server";
import { getEvent } from "@/services/catalog";

export const revalidate = 60;

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;
  const event = await getEvent(slug).catch((err) => {
    console.error(`[hs86e] /api/events/${slug} recovered from unexpected failure:`, err);
    return null;
  });
  if (!event) {
    return NextResponse.json({ error: "Event not found" }, { status: 404 });
  }
  return NextResponse.json({ event });
}
