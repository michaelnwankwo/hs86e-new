import { NextResponse } from "next/server";
import { walletEnabled } from "@/lib/env";
import { requireAccountSession, sessionUserId } from "@/lib/account-session";
import { listLedger, type LedgerRow } from "@/lib/wallet/store";

export const dynamic = "force-dynamic";

const MAX_LIMIT = 100;

/** Escape a value for RFC-4180 CSV. */
function csvCell(value: string): string {
  return /[",\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

function toCsv(rows: LedgerRow[]): string {
  const header = "receipt_id,date,type,direction,amount_minor,balance_after_minor,status,reference,note";
  const lines = rows.map((r) => [
    csvCell(r.public_id),
    csvCell(r.created_at),
    csvCell(r.kind),
    csvCell(r.direction),
    String(r.amount_minor),
    r.balance_after_minor == null ? "" : String(r.balance_after_minor),
    csvCell(r.status),
    csvCell(r.ref),
    csvCell(r.note ?? ""),
  ].join(","));
  return [header, ...lines].join("\r\n");
}

/** Wallet history — keyset paginated with `?before=<iso>`, CSV via `?format=csv`. */
export async function GET(request: Request) {
  const auth = await requireAccountSession();
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  if (!walletEnabled()) return NextResponse.json({ error: "Wallet is not enabled yet" }, { status: 403 });

  const id = sessionUserId(auth.session);
  if (!id) return NextResponse.json({ error: "Invalid account session" }, { status: 401 });

  const url = new URL(request.url);
  const format = url.searchParams.get("format");
  const before = url.searchParams.get("before");
  const beforeIso = before && /^\d{4}-\d{2}-\d{2}T[\d:.]+Z$/.test(before) ? before : undefined;
  const limitRaw = Number(url.searchParams.get("limit") ?? "50");
  const limit = Number.isInteger(limitRaw) && limitRaw > 0 ? Math.min(limitRaw, MAX_LIMIT) : 50;

  try {
    const rows = await listLedger(id, format === "csv" ? MAX_LIMIT : limit, beforeIso);
    if (format === "csv") {
      return new NextResponse(toCsv(rows), {
        status: 200,
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": 'attachment; filename="hs86e-wallet-statement.csv"',
          "Cache-Control": "no-store",
        },
      });
    }
    const nextBefore = rows.length === limit ? rows[rows.length - 1].created_at : null;
    return NextResponse.json({ rows, nextBefore }, { headers: { "Cache-Control": "no-store" } });
  } catch (err) {
    console.error("[hs86e] wallet transactions failed:", err);
    return NextResponse.json({ error: "Wallet history unavailable" }, { status: 503 });
  }
}
