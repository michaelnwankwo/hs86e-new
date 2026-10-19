"use client";

import { AlertTriangle, Ban, CheckCircle2, XCircle } from "lucide-react";
import type { ScanValidateResponse } from "@/lib/types";
import { TRANSFER_VOID_STATUS } from "@/lib/constants";
import { cn } from "@/lib/utils";

function formatProcessedAt(value?: string) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const pad = (part: number) => String(part).padStart(2, "0");
  return `${pad(date.getDate())}/${pad(date.getMonth() + 1)}/${date.getFullYear()}, ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
}

export function AttendeeResultCard({ result }: { result: ScanValidateResponse }) {
  const valid = result.verdict === "valid" || result.verdict === "already_synced";
  const duplicate = result.verdict === "duplicate";
  const transferred = result.verdict === "transferred";
  const queuedSync = valid && Boolean(result.offline || result.wpSyncPending);
  const Icon = transferred
    ? Ban
    : valid
      ? CheckCircle2
      : duplicate
        ? AlertTriangle
        : XCircle;

  const label = valid
    ? "VALID · ADMISSION GRANTED"
    : duplicate
      ? "INVALID · ALREADY SCANNED / ADMISSION DENIED"
      : result.statusLabel || (transferred ? TRANSFER_VOID_STATUS : result.verdict.toUpperCase());

  const processedAt = duplicate ? formatProcessedAt(result.checkedInAt) : "";

  return (
    <div
      className={cn(
        "min-w-0 rounded-2xl border p-4",
        valid
          ? "border-emerald-300/35 bg-emerald-950/45"
          : "border-danger-bright/55 bg-[#171016]",
      )}
    >
      <div className={cn("flex min-w-0 items-start gap-2", valid ? "text-emerald-200" : "text-danger-bright")}>
        <Icon className="mt-0.5 h-5 w-5 shrink-0" />
        <span className="min-w-0 flex-1 break-words text-xs font-bold uppercase tracking-[0.12em] sm:tracking-[0.18em]">
          {label}
        </span>
        {queuedSync ? (
          <span className="shrink-0 rounded-full border border-emerald-300/30 bg-emerald-900/40 px-2 py-0.5 text-[10px] font-semibold text-emerald-200">
            SYNC QUEUED
          </span>
        ) : null}
      </div>

      {valid ? (
        <p className="mt-3 break-words font-display text-lg leading-snug text-emerald-100">
          VERIFIED TICKET HOLDER · Ticket {result.ticketId}
        </p>
      ) : duplicate ? (
        <>
          <p className="mt-3 break-words font-display text-xl uppercase tracking-wide text-ink">
            Ticket {result.ticketId}
          </p>
          <p className="mt-2 text-sm font-semibold text-danger-bright">ADMISSION DENIED</p>
          <p className="mt-1 text-xs text-rose-100/80">
            Processed at {processedAt || "time unavailable"}
          </p>
        </>
      ) : transferred ? (
        <p className="mt-3 break-words font-display text-xl uppercase tracking-wide text-ink">
          {TRANSFER_VOID_STATUS}
        </p>
      ) : (
        <>
          <p className="mt-3 break-words font-display text-2xl text-ink">{result.attendeeName || "Unknown guest"}</p>
          <p className="mt-1 break-words text-sm text-ink-muted">
            {result.tier || "Ticket"} · {result.ticketId}
          </p>
        </>
      )}

      {valid && queuedSync ? (
        <p className="mt-2 text-xs text-emerald-200/90">
          {result.offline ? "Saved on this device · sync queued." : "Remote sync queued."}
        </p>
      ) : null}
      {!valid && !duplicate ? (
        <p className="mt-2 text-xs text-rose-100/80">{result.message}</p>
      ) : null}
    </div>
  );
}
