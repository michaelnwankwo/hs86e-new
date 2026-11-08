"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  CalendarDays,
  Check,
  ChevronDown,
  Copy,
  MapPin,
  RefreshCw,
  Send,
  Share2,
  Ticket,
  TicketPercent,
} from "lucide-react";
import { cn, copyText, formatWhen } from "@/lib/utils";
import { passSharePath } from "@/lib/ticket-payload";
import type { IssuedTicket } from "@/lib/types";
import { useToast } from "@/components/ui/Toast";
import { Button } from "@/components/ui/Button";
import { QRTicket } from "@/components/ticketing/QRTicket";
import { LivePassFrame } from "@/components/ticketing/LivePassFrame";
import { DownloadTicketButton } from "@/components/ticketing/DownloadTicketButton";
import { TransferTicketModal } from "@/components/ticketing/TransferTicketModal";

type LoadState =
  | { status: "loading"; tickets: IssuedTicket[] }
  | { status: "ready"; tickets: IssuedTicket[] }
  | { status: "error"; message: string; tickets: IssuedTicket[] };

function statusTone(ticket: IssuedTicket) {
  if (ticket.holder === false) {
    return { label: "Transferred", cls: "border border-gold/30 text-gold" };
  }
  const live = ticket.status === "Not Checked In" || !ticket.status;
  if (live) return { label: "Ready", cls: "bg-[#043927] text-[#F8FAFC]" };
  return { label: ticket.status, cls: "border border-gold/30 text-gold" };
}

function TicketSkeleton() {
  return (
    <div className="space-y-3" aria-hidden>
      {[0, 1, 2].map((n) => (
        <div
          key={n}
          className="h-[72px] animate-pulse rounded-xl border border-gold/10 bg-[#111111]/60"
        />
      ))}
    </div>
  );
}

function AccountTicketCard({
  ticket,
  open,
  onToggle,
  onTransferred,
}: {
  ticket: IssuedTicket;
  open: boolean;
  onToggle: () => void;
  onTransferred: (ticket: IssuedTicket) => void;
}) {
  const toast = useToast();
  const [copied, setCopied] = useState(false);
  const [transferOpen, setTransferOpen] = useState(false);
  const svgId = `account-qr-${ticket.ticketId.replace(/[^A-Za-z0-9_-]/g, "")}`;
  const tone = statusTone(ticket);
  const live = ticket.status === "Not Checked In" || !ticket.status;
  const transferredAway = ticket.holder === false;
  const showQr = live && !transferredAway;
  const passIndex = ticket.passIndex || 1;
  const passTotal = ticket.passTotal || 1;
  const panelId = `${svgId}-panel`;

  async function copyId(event?: React.MouseEvent) {
    event?.preventDefault();
    event?.stopPropagation();
    if (await copyText(ticket.ticketId)) {
      setCopied(true);
      toast("Ticket ID copied!");
      window.setTimeout(() => setCopied(false), 1600);
    }
  }

  async function sharePass(event?: React.MouseEvent) {
    event?.preventDefault();
    event?.stopPropagation();
    const url = `${window.location.origin}${passSharePath(ticket.ticketId)}`;
    const title = `${ticket.eventName} · Pass ${passIndex} of ${passTotal}`;
    if (typeof navigator !== "undefined" && typeof navigator.share === "function") {
      try {
        await navigator.share({ title, text: `HS86E pass ${ticket.ticketId}`, url });
        return;
      } catch (err) {
        if (err instanceof DOMException && err.name === "AbortError") return;
      }
    }
    if (await copyText(url)) toast("Pass link copied!");
  }

  return (
    <article
      className={cn(
        "overflow-hidden rounded-xl border border-gold/25 bg-[#111111]/80 backdrop-blur-md",
        "shadow-lg shadow-black/40 transition-colors duration-300",
        open ? "border-gold/45" : "hover:border-gold/40",
      )}
    >
      {/* Collapsed row — always visible, one tap to expand */}
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        aria-controls={panelId}
        className="flex w-full items-center gap-3 px-4 py-4 text-left"
      >
        <span
          aria-hidden
          className="grid h-11 w-11 shrink-0 place-items-center rounded-lg border border-gold/30 bg-gold/10"
        >
          <Ticket className="h-5 w-5 text-gold" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-semibold text-ink sm:text-base">
            {ticket.eventName || "HS86E Event"}
          </span>
          <span className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-ink-muted">
            {ticket.startsAt ? (
              <span className="inline-flex items-center gap-1">
                <CalendarDays className="h-3 w-3 text-gold/70" aria-hidden />
                {formatWhen(ticket.startsAt)}
              </span>
            ) : null}
            <span className="font-mono tracking-[0.12em] text-[#F5D68D]/90">{ticket.ticketId}</span>
          </span>
        </span>
        <span className="hidden shrink-0 rounded-full border border-gold/30 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-[0.14em] text-gold sm:inline-flex">
          {ticket.tier || "Regular"}
        </span>
        <span
          className={cn(
            "shrink-0 rounded-full px-2 py-0.5 text-[9px] font-semibold uppercase tracking-[0.12em]",
            tone.cls,
          )}
        >
          {tone.label}
        </span>
        <ChevronDown
          className={cn(
            "h-4 w-4 shrink-0 text-gold transition-transform duration-300",
            open && "rotate-180",
          )}
          aria-hidden
        />
      </button>

      {/* Expandable body — smooth grid-rows reveal */}
      <div
        id={panelId}
        className={cn(
          "grid transition-[grid-template-rows] duration-300 ease-out",
          open ? "grid-rows-[1fr]" : "grid-rows-[0fr]",
        )}
      >
        <div className="overflow-hidden">
          <div className="border-t border-gold/20 px-4 pb-5 pt-4">
            <div className="grid gap-4 sm:grid-cols-[1fr_auto] sm:items-start">
              <div className="min-w-0 space-y-2 text-sm text-[#DFB260]/90">
                <p className="text-base font-semibold text-ink">{ticket.attendeeName || "Guest"}</p>
                <p className="text-[10px] uppercase tracking-[0.16em] text-gold/80">
                  Pass {passIndex} of {passTotal} · Order #{ticket.orderId}
                </p>
                {ticket.venueName ? (
                  <p className="flex items-center gap-2">
                    <MapPin className="h-4 w-4 shrink-0 text-gold" aria-hidden />
                    <span className="min-w-0">{ticket.venueName}</span>
                  </p>
                ) : null}
                {ticket.startsAt ? (
                  <p className="flex items-center gap-2">
                    <CalendarDays className="h-4 w-4 shrink-0 text-gold" aria-hidden />
                    {formatWhen(ticket.startsAt)}
                  </p>
                ) : null}
                <button
                  type="button"
                  onClick={(e) => void copyId(e)}
                  className="mt-1 inline-flex items-center gap-2 rounded-lg border border-gold/25 bg-surface px-3 py-2 text-left"
                  aria-label="Copy ticket ID"
                >
                  <span className="font-mono text-[11px] tracking-[0.12em] text-[#F5D68D]">
                    {ticket.ticketId}
                  </span>
                  {copied ? (
                    <Check className="h-3.5 w-3.5 text-gold" aria-hidden />
                  ) : (
                    <Copy className="h-3.5 w-3.5 text-gold" aria-hidden />
                  )}
                </button>
              </div>

              <div className="flex flex-col items-center gap-2 sm:w-[220px]">
                {transferredAway ? (
                  <div className="w-full rounded-xl border border-gold/20 bg-[#0B0E14] px-4 py-6 text-center">
                    <p className="text-xs text-ink">Transferred to</p>
                    <p className="mt-1 break-all font-mono text-[11px] text-[#F5D68D]">
                      {ticket.transferredTo || ticket.assignedEmail}
                    </p>
                    <p className="mt-2 text-[10px] leading-relaxed text-gold/70">
                      Your QR for this seat is void.
                    </p>
                  </div>
                ) : showQr ? (
                  <LivePassFrame ticket={ticket}>
                    <div id={svgId}>
                      <QRTicket ticket={ticket} ticketId={ticket.ticketId} size={180} />
                    </div>
                  </LivePassFrame>
                ) : (
                  <div className="w-full rounded-xl border border-gold/20 bg-[#0B0E14] px-4 py-6 text-center text-xs text-gold/80">
                    {ticket.status}
                  </div>
                )}
              </div>
            </div>

            <div className="mt-4 flex flex-wrap items-center gap-2">
              <Button variant="gold" onClick={() => void sharePass()}>
                <Share2 className="h-4 w-4" aria-hidden />
                Share
              </Button>
              {showQr ? (
                <Button variant="ghost" onClick={() => setTransferOpen(true)}>
                  <Send className="h-4 w-4" aria-hidden />
                  Transfer
                </Button>
              ) : null}
              {showQr ? (
                <DownloadTicketButton ticket={ticket} svgSelector={`#${svgId} svg`} />
              ) : null}
            </div>
          </div>
        </div>
      </div>

      <TransferTicketModal
        ticket={ticket}
        open={transferOpen}
        onClose={() => setTransferOpen(false)}
        onTransferred={(result) => {
          onTransferred({
            ...ticket,
            ...result.ticket,
            holder: false,
            transferredTo: result.toEmail,
            assignedEmail: result.toEmail,
            qrPayload: undefined,
            qrToken: undefined,
          });
          toast(`Transferred to ${result.toEmail}`);
        }}
      />
    </article>
  );
}

export function AccountTicketStack() {
  const [state, setState] = useState<LoadState>({ status: "loading", tickets: [] });
  const [openId, setOpenId] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async (mode: "initial" | "refresh" = "initial") => {
    if (mode === "refresh") setRefreshing(true);
    try {
      const response = await fetch("/api/account/tickets", {
        cache: "no-store",
        credentials: "same-origin",
      });
      const payload = (await response.json().catch(() => null)) as
        | { tickets?: IssuedTicket[]; error?: string }
        | null;
      if (response.status === 401) {
        setState({ status: "error", message: "Please sign in again to view your tickets.", tickets: [] });
        return;
      }
      if (!response.ok) {
        setState({
          status: "error",
          message: payload?.error || "Your tickets could not be loaded. Please retry.",
          tickets: [],
        });
        return;
      }
      const tickets = Array.isArray(payload?.tickets)
        ? payload!.tickets.filter((t): t is IssuedTicket => Boolean(t?.ticketId))
        : [];
      setState({ status: "ready", tickets });
    } catch {
      setState({
        status: "error",
        message: "Network error — check your connection and retry.",
        tickets: [],
      });
    } finally {
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  // Auto-expand the first pass so the QR flow is discoverable.
  useEffect(() => {
    if (state.status === "ready" && openId === null && state.tickets.length > 0) {
      setOpenId(state.tickets[0].ticketId);
    }
  }, [state, openId]);

  const count = state.tickets.length;
  const tickets = useMemo(() => state.tickets, [state.tickets]);

  return (
    <section
      aria-labelledby="account-tickets-heading"
      className="rounded-2xl border border-gold/25 bg-[#111111]/80 p-5 shadow-xl shadow-black/30 backdrop-blur-md sm:p-6"
    >
      <div className="mb-4 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <TicketPercent className="h-5 w-5 text-gold" aria-hidden />
          <h2
            id="account-tickets-heading"
            className="text-xs font-semibold uppercase tracking-[0.18em] text-gold"
          >
            My tickets
          </h2>
          {count > 0 ? (
            <span className="rounded-full border border-gold/30 bg-gold/10 px-2 py-0.5 text-[10px] font-semibold text-[#F5D68D]">
              {count}
            </span>
          ) : null}
        </div>
        <button
          type="button"
          onClick={() => void load("refresh")}
          className="grid h-9 w-9 place-items-center rounded-full border border-gold/20 text-gold transition-colors hover:border-gold/40 hover:text-[#F5D68D]"
          aria-label="Refresh tickets"
        >
          <RefreshCw className={cn("h-4 w-4", refreshing && "animate-spin")} aria-hidden />
        </button>
      </div>

      {state.status === "loading" ? <TicketSkeleton /> : null}

      {state.status === "error" ? (
        <div role="alert" className="rounded-xl border border-danger-bright/30 bg-[#1A0F0F]/60 px-4 py-5 text-center">
          <p className="text-sm text-danger-bright">{state.message}</p>
          <button
            type="button"
            onClick={() => void load("refresh")}
            className="mt-3 inline-flex min-h-10 items-center rounded-xl border border-gold/30 px-4 text-xs font-semibold text-gold hover:border-gold/50"
          >
            Retry
          </button>
        </div>
      ) : null}

      {state.status === "ready" && tickets.length === 0 ? (
        <div className="rounded-xl border border-dashed border-gold/25 bg-surface/40 px-4 py-8 text-center">
          <Ticket className="mx-auto h-8 w-8 text-gold/50" aria-hidden />
          <p className="mt-3 text-sm font-semibold text-ink">No tickets yet</p>
          <p className="mx-auto mt-1 max-w-xs text-xs leading-relaxed text-ink-muted">
            When you buy a pass, it will appear here automatically — no email lookup needed.
          </p>
          <Link
            href="/events"
            className="mt-4 inline-flex min-h-11 items-center rounded-xl bg-gold px-5 text-sm font-semibold text-[#111111] transition-colors hover:bg-[#F5D68D]"
          >
            Browse events
          </Link>
        </div>
      ) : null}

      {tickets.length > 0 ? (
        <div className="space-y-3">
          {tickets.map((ticket) => (
            <AccountTicketCard
              key={ticket.ticketId}
              ticket={ticket}
              open={openId === ticket.ticketId}
              onToggle={() =>
                setOpenId((current) => (current === ticket.ticketId ? null : ticket.ticketId))
              }
              onTransferred={(updated) =>
                setState((current) => ({
                  ...current,
                  tickets: current.tickets.map((row) =>
                    row.ticketId === updated.ticketId ? updated : row,
                  ),
                }))
              }
            />
          ))}
        </div>
      ) : null}
    </section>
  );
}
