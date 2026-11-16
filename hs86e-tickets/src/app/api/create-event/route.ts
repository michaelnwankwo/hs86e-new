import { NextResponse } from "next/server";
import { z } from "zod";
import { walletEnabled, walletFrozen, createPublishFeeMinor } from "@/lib/env";
import { requireAccountSession, sessionUserId } from "@/lib/account-session";
import { rateLimit } from "@/lib/rate-limit";
import { mintWalletRef } from "@/lib/wallet/idempotency";
import { createEventSubmission, listEventSubmissions } from "@/lib/wallet/store";

export const dynamic = "force-dynamic";

const TicketSchema = z.object({
  name: z.string().trim().min(2).max(60),
  priceMinor: z.number().int().min(0).max(500_000_000),
  quantity: z.number().int().min(1).max(1_000_000).nullable(),
});

const BodySchema = z.object({
  title: z.string().trim().min(3, "Title must be at least 3 characters").max(140),
  category: z.string().trim().max(80).optional().nullable(),
  description: z.string().trim().min(20, "Description must be at least 20 characters").max(4000),
  venueName: z.string().trim().max(120).optional().nullable(),
  venueAddress: z.string().trim().max(200).optional().nullable(),
  city: z.string().trim().max(80).optional().nullable(),
  startsAt: z.string().datetime({ offset: true }),
  endsAt: z.string().datetime({ offset: true }).optional().nullable(),
  tickets: z.array(TicketSchema).min(1, "Add at least one ticket tier").max(10),
});

export async function GET() {
  const auth = await requireAccountSession();
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const id = sessionUserId(auth.session);
  if (!id) return NextResponse.json({ error: "Invalid account session" }, { status: 401 });

  const feeMinor = createPublishFeeMinor();
  if (!walletEnabled()) {
    return NextResponse.json({ walletEnabled: false, feeMinor, currency: "NGN", submissions: [] });
  }
  try {
    const submissions = await listEventSubmissions(id, 10);
    return NextResponse.json(
      { walletEnabled: true, frozen: walletFrozen(), feeMinor, currency: "NGN", submissions },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (err) {
    // Supabase may not be migrated yet — serve a calm 200 so /create renders
    // its "launching soon"/preview state instead of an error.
    console.error("[hs86e] create-event submissions failed:", err);
    return NextResponse.json({ walletEnabled: false, feeMinor: createPublishFeeMinor(), currency: "NGN", submissions: [] });
  }
}

export async function POST(request: Request) {
  const auth = await requireAccountSession();
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  if (!walletEnabled()) return NextResponse.json({ error: "Event creation launches with the HS86E Wallet" }, { status: 403 });
  if (walletFrozen()) return NextResponse.json({ error: "Wallet is frozen for maintenance" }, { status: 423 });

  const limited = rateLimit(`create-event:${auth.session.user.id}`, 10, 60 * 60 * 1000);
  if (!limited.ok) {
    return NextResponse.json({ error: "Too many submissions. Try again later." }, { status: 429 });
  }

  const id = sessionUserId(auth.session);
  if (!id) return NextResponse.json({ error: "Invalid account session" }, { status: 401 });

  const parsed = BodySchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid event", issues: parsed.error.issues.map((i) => i.message) },
      { status: 400 },
    );
  }
  const data = parsed.data;
  const startsAt = new Date(data.startsAt);
  if (Number.isNaN(startsAt.getTime()) || startsAt.getTime() <= Date.now() + 5 * 60 * 1000) {
    return NextResponse.json({ error: "Start time must be in the future" }, { status: 400 });
  }
  const endsAt = data.endsAt ? new Date(data.endsAt) : null;
  if (endsAt && (Number.isNaN(endsAt.getTime()) || endsAt.getTime() <= startsAt.getTime())) {
    return NextResponse.json({ error: "End time must be after the start time" }, { status: 400 });
  }

  const feeMinor = createPublishFeeMinor();
  const ref = mintWalletRef("WLT-FEE");
  const email = typeof auth.session.user.email === "string" ? auth.session.user.email : null;

  try {
    const result = await createEventSubmission({
      userId: id,
      email,
      title: data.title,
      category: data.category ?? null,
      description: data.description,
      venueName: data.venueName ?? null,
      venueAddress: data.venueAddress ?? null,
      city: data.city ?? null,
      startsAt: startsAt.toISOString(),
      endsAt: endsAt ? endsAt.toISOString() : null,
      tickets: data.tickets,
      feeMinor,
      ref,
    });
    if (!result.ok) {
      if (result.error === "insufficient_funds") {
        return NextResponse.json(
          { error: "insufficient_funds", availableMinor: result.availableMinor, feeMinor },
          { status: 409 },
        );
      }
      if (result.error === "wallet_not_active") {
        return NextResponse.json({ error: "Wallet is not active" }, { status: 423 });
      }
      const clientErr = ["title_too_short", "description_too_short", "starts_at_must_be_future", "ends_at_must_follow_starts_at", "bad_fee"];
      return NextResponse.json(
        { error: result.error },
        { status: clientErr.includes(result.error ?? "") ? 400 : 502 },
      );
    }
    return NextResponse.json(
      { ok: true, submissionId: result.submissionId, ref: result.ref ?? ref, feeMinor, availableMinor: result.availableMinor, status: result.status },
      { status: 201 },
    );
  } catch (err) {
    console.error("[hs86e] create-event submission failed:", err);
    return NextResponse.json({ error: "Could not submit your event. Please try again." }, { status: 502 });
  }
}
