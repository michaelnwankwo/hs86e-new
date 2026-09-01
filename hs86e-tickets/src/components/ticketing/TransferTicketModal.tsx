"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { Check, Copy, X } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Spinner } from "@/components/ui/Spinner";
import { StatusBanner } from "@/components/ui/StatusBanner";
import { TRANSFER_CONFIRM_COPY } from "@/lib/constants";
import { currentOwnerEmail, passSharePath } from "@/lib/ticket-payload";
import type { IssuedTicket } from "@/lib/types";
import { copyText, isValidEmail } from "@/lib/utils";
import { useToast } from "@/components/ui/Toast";

export function TransferTicketModal({
  ticket,
  open,
  onClose,
  onTransferred,
}: {
  ticket: IssuedTicket;
  open: boolean;
  onClose: () => void;
  onTransferred: (result: {
    ticket: IssuedTicket;
    toEmail: string;
    claimUrl: string;
    emailSent: boolean;
  }) => void;
}) {
  const toast = useToast();
  const titleId = useId();
  const confirmId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const fromEmail = currentOwnerEmail(ticket) || ticket.attendeeEmail;
  const [toEmail, setToEmail] = useState("");
  const [toName, setToName] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const [touched, setTouched] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<{ claimUrl: string; emailSent: boolean; toEmail: string } | null>(
    null,
  );
  const [linkCopied, setLinkCopied] = useState(false);

  const emailValid = useMemo(() => isValidEmail(toEmail), [toEmail]);
  const emailHint = !toEmail.trim()
    ? touched
      ? "Enter the recipient's email."
      : null
    : emailValid
      ? null
      : "Enter a valid email address.";
  const canSubmit = Boolean(fromEmail) && emailValid && confirmed && !busy;

  useEffect(() => {
    if (!open) return;
    setToEmail("");
    setToName("");
    setConfirmed(false);
    setTouched(false);
    setError(null);
    setDone(null);
    setBusy(false);
    setLinkCopied(false);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const timer = window.setTimeout(() => inputRef.current?.focus(), 40);
    return () => {
      document.body.style.overflow = prev;
      window.clearTimeout(timer);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !busy) onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, busy, onClose]);

  if (!open) return null;

  const passLabel =
    ticket.passIndex && ticket.passTotal
      ? `Pass ${ticket.passIndex} of ${ticket.passTotal}`
      : "Pass";

  async function copyClaim(url: string) {
    if (await copyText(url)) {
      setLinkCopied(true);
      toast("Pass link copied!");
      window.setTimeout(() => setLinkCopied(false), 1600);
    }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setTouched(true);
    if (!canSubmit) {
      setError(emailHint || "Confirm the transfer before continuing.");
      return;
    }
    setError(null);
    setBusy(true);
    try {
      const res = await fetch("/api/tickets/transfer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ticketId: ticket.ticketId,
          fromEmail,
          toEmail: toEmail.trim(),
          toName: toName.trim() || undefined,
        }),
      });
      const data = (await res.json()) as {
        error?: string;
        ticket?: IssuedTicket;
        claimUrl?: string;
        emailSent?: boolean;
      };
      if (!res.ok || !data.ticket) {
        throw new Error(data.error || "Transfer failed");
      }
      const origin = window.location.origin;
      const claimUrl = data.claimUrl || `${origin}${passSharePath(ticket.ticketId)}`;
      const result = {
        ticket: data.ticket,
        toEmail: toEmail.trim().toLowerCase(),
        claimUrl,
        emailSent: Boolean(data.emailSent),
      };
      setDone({ claimUrl, emailSent: result.emailSent, toEmail: result.toEmail });
      onTransferred(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Transfer failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-[70] flex items-end justify-center bg-[#0B0E14]/80 p-4 backdrop-blur-md sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      onClick={() => {
        if (!busy) onClose();
      }}
    >
      <div
        className="relative w-full max-w-md overflow-hidden rounded-2xl border border-[#DFB260]/25 bg-[#161B22] p-5 shadow-gold"
        onClick={(e) => e.stopPropagation()}
      >
        {busy ? (
          <div
            className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-[#0B0E14]/70 backdrop-blur-[2px]"
            role="status"
            aria-live="polite"
          >
            <Spinner label="Transferring" />
          </div>
        ) : null}

        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#DFB260]">
              {passLabel} · {ticket.ticketId}
            </p>
            <h2 id={titleId} className="mt-1 font-display text-2xl text-[#F8FAFC]">
              Transfer ticket
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="grid h-10 w-10 place-items-center rounded-full border border-[#DFB260]/20 text-[#DFB260]"
            aria-label="Close"
            disabled={busy}
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {done ? (
          <div className="space-y-3">
            <StatusBanner tone="success">Pass successfully transferred!</StatusBanner>
            <p className="text-sm text-[#F8FAFC]/80">
              Assigned to <span className="font-mono text-[#F5D68D]">{done.toEmail}</span>. Your QR
              is void.
            </p>
            {done.emailSent ? (
              <p className="text-sm text-[#DFB260]/80">They also got an email with this link.</p>
            ) : (
              <>
                <StatusBanner tone="warn">
                  Email could not be sent from this server. Copy the claim link and send it to the
                  guest.
                </StatusBanner>
                <div className="flex items-stretch gap-2">
                  <button
                    type="button"
                    className="min-w-0 flex-1 truncate rounded-xl border border-[#DFB260]/20 bg-[#0B0E14] px-3 py-3 text-left font-mono text-xs text-[#F5D68D]"
                    onClick={() => void copyClaim(done.claimUrl)}
                  >
                    {done.claimUrl}
                  </button>
                  <button
                    type="button"
                    onClick={() => void copyClaim(done.claimUrl)}
                    className="grid h-12 w-12 shrink-0 place-items-center rounded-xl border border-[#DFB260]/20 text-[#DFB260]"
                    aria-label="Copy claim link"
                  >
                    {linkCopied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                  </button>
                </div>
              </>
            )}
            <Button variant="gold" block onClick={onClose}>
              Done
            </Button>
          </div>
        ) : (
          <form className="space-y-3" onSubmit={(e) => void submit(e)} noValidate>
            <p className="rounded-xl border border-[#DFB260]/25 bg-[#0B0E14] px-3 py-3 text-sm leading-relaxed text-[#F8FAFC]/85">
              {TRANSFER_CONFIRM_COPY}
            </p>
            {fromEmail ? (
              <p className="text-xs text-[#DFB260]/70">
                From <span className="font-mono text-[#F5D68D]">{fromEmail}</span>
              </p>
            ) : (
              <StatusBanner tone="warn">
                Look this pass up with the checkout email before transferring.
              </StatusBanner>
            )}
            <label className="block">
              <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#DFB260]">
                Recipient email
              </span>
              <input
                ref={inputRef}
                type="email"
                autoComplete="email"
                inputMode="email"
                value={toEmail}
                onChange={(e) => {
                  setToEmail(e.target.value);
                  setTouched(true);
                  setError(null);
                }}
                onBlur={() => setTouched(true)}
                placeholder="guest@email.com"
                aria-invalid={Boolean(emailHint)}
                className={`mt-2 w-full rounded-xl border bg-[#0B0E14] px-3 py-3 text-[#F8FAFC] ${
                  emailHint
                    ? "border-danger-bright/70"
                    : emailValid
                      ? "border-[#0E7A52]"
                      : "border-[#DFB260]/20"
                }`}
              />
              {emailHint ? <p className="mt-1.5 text-xs text-danger-bright">{emailHint}</p> : null}
            </label>
            <label className="block">
              <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#DFB260]">
                Guest name <span className="text-[#DFB260]/50">(optional)</span>
              </span>
              <input
                value={toName}
                onChange={(e) => setToName(e.target.value)}
                placeholder="Name on the door list"
                disabled={busy}
                className="mt-2 w-full rounded-xl border border-[#DFB260]/20 bg-[#0B0E14] px-3 py-3 text-[#F8FAFC]"
              />
            </label>
            <label htmlFor={confirmId} className="flex items-start gap-3 rounded-xl bg-[#0B0E14] px-3 py-3">
              <input
                id={confirmId}
                type="checkbox"
                checked={confirmed}
                onChange={(e) => setConfirmed(e.target.checked)}
                disabled={busy}
                className="mt-1 h-4 w-4 accent-[#043927]"
              />
              <span className="text-xs leading-relaxed text-[#F8FAFC]/80">
                I understand this voids my QR and the guest becomes the only valid holder.
              </span>
            </label>
            {error ? <StatusBanner tone="danger">{error}</StatusBanner> : null}
            <div className="grid grid-cols-2 gap-2 pt-1">
              <Button variant="ghost" type="button" onClick={onClose} disabled={busy}>
                Cancel
              </Button>
              <Button variant="primary" type="submit" disabled={!canSubmit}>
                {busy ? "Transferring…" : "Transfer"}
              </Button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
