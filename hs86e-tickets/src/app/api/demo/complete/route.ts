import { NextResponse } from "next/server";
import { z } from "zod";
import { isDemoMode } from "@/lib/env";
import { completeDemoOrder, getDemoOrderByKey } from "@/services/demo/store";

const schema = z.object({
  orderId: z.coerce.number().int().positive(),
  orderKey: z.string().min(4),
});

export async function POST(request: Request) {
  try {
    return await handlePost(request);
  } catch (err) {
    console.error("[hs86e] /api/demo/complete recovered from unexpected failure:", err);
    return NextResponse.json(
      { error: "Demo checkout is temporarily unavailable" },
      { status: 503 },
    );
  }
}

async function handlePost(request: Request) {
  if (!isDemoMode()) {
    return NextResponse.json({ error: "Demo completion is disabled" }, { status: 403 });
  }
  const json = await request.json().catch(() => null);
  const parsed = schema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }
  const existing = getDemoOrderByKey(parsed.data.orderId, parsed.data.orderKey);
  if (!existing) {
    return NextResponse.json({ error: "Order not found" }, { status: 404 });
  }
  const order = completeDemoOrder(parsed.data.orderId, `demo_${parsed.data.orderId}`);
  return NextResponse.json({
    ok: true,
    orderId: order?.id,
    orderKey: order?.orderKey,
    tickets: order?.tickets.length ?? 0,
  });
}
