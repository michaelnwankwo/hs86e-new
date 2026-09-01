"use client";

import { useState } from "react";
import { CalendarDays, Check, ChevronDown, Copy, MapPin, Send, Share2 } from "lucide-react";
import { cn, copyText, formatWhen } from "@/lib/utils";
import { passSharePath } from "@/lib/ticket-payload";
import type { IssuedTicket } from "@/lib/types";
import { useToast } from "@/components/ui/Toast";
import { Button } from "@/components/ui/Button";
import { QRTicket } from "./QRTicket";
import { DownloadTicketButton } from "./DownloadTicketButton";
import { TransferTicketModal } from "./TransferTicketModal";

export function TicketCard({
  ticket,
  open,
  onToggle,
  onTransferred,
  index,
  total,
  highlight,
}: {
  ticket: IssuedTicket;
  open: boolean;
  onToggle: () => void;
  onTransferred?: (ticket: IssuedTicket) => void;
  index?: number;
  total?: number;
  highlight?: boolean;
}) {
  const toast = useToast();
  const svgId = `qr-${ticket.ticketId.replace(/[^A-Za-z0-9_-]/g, "")}`;
  const live = ticket.status === "Not Checked In" || !ticket.status;
  const passIndex = ticket.passIndex || index || 1;
  const passTotal = ticket.passTotal || total || 1;
  const transferredAway = ticket.holder === false;
  const showQr = live && !transferredAway;
  const [copied, setCopied] = useState(false);
  const [transferOpen, setTransferOpen] = useState(false);

  async function copyId(e?: React.MouseEvent) {
    e?.preventDefault();
    e?.stopPropagation();
    if (await copyText(ticket.ticketId)) {
      setCopied(true);
      toast("Ticket ID copied!");
      window.setTimeout(() => setCopied(false), 1600);
    }
  }

  async function sharePass(e?: React.MouseEvent) {
    e?.preventDefault();
    e?.stopPropagation();
    const url = `${window.location.origin}${passSharePath(ticket.ticketId)}`;
    const title = `${ticket.eventName} · Pass ${passIndex} of ${passTotal}`;
    const text = `HS86E pass ${ticket.ticketId}`;
    if (typeof navigator !== "undefined" && typeof navigator.share === "function") {
      try {
        await navigator.share({ title, text, url });
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
        "overflow-hidden rounded-2xl border border-[#DFB260]/20 bg-[#161B22]",
        highlight && "shadow-glow ring-1 ring-[#F5D68D]/50",
      )}
    >
      <div className="px-4 py-3.5">
        <div className="flex items-start gap-3">
          <button type="button" onClick={onToggle} aria-expanded={open} className="min-w-0 flex-1 text-left">
            <p className="truncate font-display text-base font-semibold uppercase tracking-wide text-[#F8FAFC]">
              {ticket.eventName}
            </p>
            {passTotal > 1 ? (
              <span className="mt-1.5 inline-flex items-center rounded-full border border-[#DFB260]/30 bg-[#DFB260]/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-[#F5D68D]">
                Pass {passIndex} of {passTotal}
              </span>
            ) : (
              <p className="mt-1 text-[10px] uppercase tracking-[0.14em] text-[#DFB260]/80">
                Pass {passIndex} of {passTotal}
              </p>
            )}
          </button>
          <span className="shrink-0 rounded-full border border-[#DFB260]/30 px-2.5 py-1 text-[9px] font-semibold uppercase tracking-[0.14em] text-[#DFB260]">
            {ticket.tier}
          </span>
          <span
            className={cn(
              "shrink-0 rounded-full px-2.5 py-1 text-[9px] font-semibold uppercase tracking-[0.12em]",
              transferredAway
                ? "border border-[#DFB260]/30 text-[#DFB260]"
                : live
                  ? "bg-[#043927] text-[#F8FAFC]"
                  : "border border-[#DFB260]/30 text-[#DFB260]",
            )}
          >
            {transferredAway ? "Transferred" : live ? "Ready" : ticket.status}
          </span>
          <button
            type="button"
            onClick={onToggle}
            className="grid h-8 w-8 shrink-0 place-items-center text-[#DFB260]"
            aria-label={open ? "Collapse pass" : "Expand pass"}
          >
            <ChevronDown
              className={cn("h-4 w-4 transition-transform duration-300", open && "rotate-180")}
              aria-hidden
            />
          </button>
        </div>

        <div className="mt-2 flex items-center gap-1.5">
          <span className="min-w-0 truncate font-mono text-[11px] tracking-[0.12em] text-[#F5D68D]">
            {ticket.ticketId}
          </span>
          <button
            type="button"
            onClick={(e) => void copyId(e)}
            className="grid h-8 w-8 shrink-0 place-items-center rounded-full border border-[#DFB260]/20 text-[#DFB260] hover:bg-[#DFB260]/10"
            aria-label="Copy ticket ID"
          >
            {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
          </button>
          <button
            type="button"
            onClick={(e) => void sharePass(e)}
            className="grid h-8 w-8 shrink-0 place-items-center rounded-full border border-[#DFB260]/20 text-[#DFB260] hover:bg-[#DFB260]/10"
            aria-label="Share pass"
          >
            <Share2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      <div
        className={cn(
          "grid transition-[grid-template-rows] duration-300 ease-out",
          open ? "grid-rows-[1fr]" : "grid-rows-[0fr]",
        )}
      >
        <div className="overflow-hidden">
          <div className="border-t border-[#DFB260]/20 px-4 pb-5 pt-4">
            {transferredAway ? (
              <div className="rounded-2xl border border-[#DFB260]/20 bg-[#0B0E14] px-4 py-8 text-center">
                <p className="text-sm text-[#F8FAFC]">Transferred to</p>
                <p className="mt-1 break-all font-mono text-sm text-[#F5D68D]">
                  {ticket.transferredTo || ticket.assignedEmail}
                </p>
                <p className="mt-3 text-xs text-[#DFB260]/70">
                  Your QR for this seat is void. The guest can open it with their email.
                </p>
              </div>
            ) : showQr ? (
              <div id={svgId}>
                <QRTicket ticket={ticket} ticketId={ticket.ticketId} size={220} />
              </div>
            ) : (
              <div className="rounded-2xl border border-[#DFB260]/20 bg-[#0B0E14] px-4 py-8 text-center text-sm text-[#DFB260]/80">
                {ticket.status}
              </div>
            )}

            <p className="mt-4 text-center text-sm text-[#F8FAFC]">{ticket.attendeeName}</p>
            <div className="mt-2 flex items-center justify-center gap-1.5">
              <span className="font-mono text-[11px] tracking-[0.12em] text-[#F5D68D]">
                {ticket.ticketId}
              </span>
              <button
                type="button"
                onClick={(e) => void copyId(e)}
                className="grid h-8 w-8 place-items-center rounded-full text-[#DFB260]"
                aria-label="Copy ticket ID"
              >
                {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
              </button>
            </div>
            <div className="mt-3 space-y-2 text-sm text-[#DFB260]/90">
              {ticket.venueName ? (
                <p className="flex items-center justify-center gap-2">
                  <MapPin className="h-4 w-4 text-[#DFB260]" />
                  {ticket.venueName}
                </p>
              ) : null}
              {ticket.startsAt ? (
                <p className="flex items-center justify-center gap-2">
                  <CalendarDays className="h-4 w-4 text-[#DFB260]" />
                  {formatWhen(ticket.startsAt)}
                </p>
              ) : null}
              <p className="text-center text-[11px] text-[#DFB260]/70">Order #{ticket.orderId}</p>
            </div>
            <div className="mt-4 space-y-2">
              <Button variant="gold" block onClick={() => void sharePass()}>
                <Share2 className="h-4 w-4" />
                Share Pass
              </Button>
              {showQr ? (
                <Button variant="ghost" block onClick={() => setTransferOpen(true)}>
                  <Send className="h-4 w-4" />
                  Transfer Ticket
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
          onTransferred?.({
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
