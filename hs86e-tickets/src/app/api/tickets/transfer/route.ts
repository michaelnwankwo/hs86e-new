import { NextResponse } from "next/server";
import { z } from "zod";
import { TRANSFER_RATE_MAX, TRANSFER_RATE_WINDOW_MS, TRANSFER_TICKET_MAX } from "@/lib/constants";
import { clientIp, rateLimit } from "@/lib/rate-limit";
import { TransferError, transferPass } from "@/services/tickets/transfer";

export const dynamic = "force-dynamic";

const schema = z.object({
  ticketId: z.string().trim().min(4).max(80),
  fromEmail: z.string().trim().email(),
  toEmail: z.string().trim().email(),
  toName: z.string().trim().min(2).max(80).optional(),
});

export async function POST(request: Request) {
  const ip = clientIp(request);
  const limited = rateLimit(`ticket-transfer:${ip}`, TRANSFER_RATE_MAX, TRANSFER_RATE_WINDOW_MS);
  if (!limited.ok) {
    return NextResponse.json(
      { error: "Too many transfer attempts. Wait and try again." },
      { status: 429 },
    );
  }

  const json = await request.json().catch(() => null);
  const parsed = schema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Enter a valid ticket ID and recipient email." },
      { status: 400 },
    );
  }

  const perTicket = rateLimit(
    `ticket-transfer-id:${parsed.data.ticketId}`,
    TRANSFER_TICKET_MAX,
    TRANSFER_RATE_WINDOW_MS,
  );
  if (!perTicket.ok) {
    return NextResponse.json(
      { error: "This pass was transferred too many times just now." },
      { status: 429 },
    );
  }

  try {
    const result = await transferPass(parsed.data);
    return NextResponse.json({
      ok: true,
      ticket: {
        ...result.ticket,
        holder: true,
      },
      claimUrl: result.claimUrl,
      emailSent: result.emailSent,
      message: result.emailSent
        ? `Pass transferred. ${parsed.data.toEmail} has been emailed.`
        : `Pass transferred. Share the pass link with ${parsed.data.toEmail}.`,
    });
  } catch (err) {
    if (err instanceof TransferError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    return NextResponse.json({ error: "Transfer failed." }, { status: 500 });
  }
}
