"use client";

import { AlertTriangle, Ban, CheckCircle2, XCircle } from "lucide-react";
import type { ScanValidateResponse } from "@/lib/types";
import { TRANSFER_VOID_STATUS } from "@/lib/constants";
import { cn, formatTime } from "@/lib/utils";

export function AttendeeResultCard({ result }: { result: ScanValidateResponse }) {
  const transferred = result.verdict === "transferred";
  const Icon = transferred
    ? Ban
    : result.verdict === "valid"
      ? CheckCircle2
      : result.verdict === "duplicate"
        ? AlertTriangle
        : XCircle;
  const label =
    result.statusLabel ||
    (transferred
      ? TRANSFER_VOID_STATUS
      : result.verdict === "valid"
        ? "VALID"
        : result.verdict === "duplicate"
          ? "TICKET ALREADY USED"
          : result.verdict === "canceled"
            ? "CANCELED"
            : "INVALID");

  return (
    <div
      className={cn(
        "rounded-2xl p-4",
        transferred
          ? "border border-danger-bright/70 bg-danger/35"
          : "gold-border bg-surface-raised",
      )}
    >
      <div className={cn("flex items-center gap-2", transferred ? "text-danger-bright" : "text-gold")}>
        <Icon className="h-5 w-5" />
        <span className="text-xs font-bold uppercase tracking-[0.18em]">{label}</span>
        {result.offline ? (
          <span className="ml-auto rounded-full border border-gold/30 px-2 py-0.5 text-[10px] text-gold-champagne">
            OFFLINE-VERIFIED
          </span>
        ) : null}
      </div>
      {transferred ? (
        <p className="mt-3 font-display text-xl uppercase tracking-wide text-ink">
          {TRANSFER_VOID_STATUS}
        </p>
      ) : (
        <p className="mt-3 font-display text-2xl text-ink">{result.attendeeName || "Unknown guest"}</p>
      )}
      <p className="mt-1 text-sm text-ink-muted">
        {result.tier || "Ticket"} · {result.ticketId}
      </p>
      {result.verdict === "duplicate" && result.checkedInAt ? (
        <p className="mt-2 text-sm text-gold-champagne">Checked in {formatTime(result.checkedInAt)}</p>
      ) : null}
      <p className={cn("mt-2 text-xs", transferred ? "text-[#F8FAFC]" : "text-ink-dim")}>
        {result.message}
      </p>
    </div>
  );
}
