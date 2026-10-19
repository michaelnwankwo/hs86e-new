import { NextResponse } from "next/server";
import { z } from "zod";
import { getStaffSessionFromCookies } from "@/lib/auth";
import { isDemoMode } from "@/lib/env";
import { decodeTicketPayload, parseTicketPayload } from "@/lib/ticket-payload";
import { verifyHs86Payload, verifyTotpPayload } from "@/lib/ticket-token";
import { totpCounter } from "@/lib/pass-security";
import { isTicketIdShape } from "@/lib/utils";
import { checkInDemoTicket, findTicket } from "@/services/demo/store";
import { checkInTicket } from "@/services/wp/fooevents";
import { checkInLedgerTicket, ticketById, ticketsForOrder } from "@/services/tickets/ledger";
import {
  getFallbackCheckin,
  recordFallbackCheckin,
} from "@/services/tickets/wp-fallback";
import type { IssuedTicket, ScanValidateResponse } from "@/lib/types";
import { TRANSFER_VOID_MESSAGE, TRANSFER_VOID_STATUS } from "@/lib/constants";

const schema = z.object({
  ticketId: z.string().min(4).max(240),
  eventId: z.string().min(1),
  deviceId: z.string().min(2).max(64),
  scannedAt: z.string().datetime().optional(),
});

function passMessage(ticket: IssuedTicket, used: boolean) {
  const index = ticket.passIndex || 1;
  const total = ticket.passTotal || ticketsForOrder(ticket.orderId).length || 1;
  // RSG-ENG-SEC-006 §1.1 — directive-exact rejection copy on re-scan.
  return used
    ? "ALREADY SCANNED / ADMISSION DENIED"
    : `Ticket ${index} of ${total} checked in`;
}

// RSG-ENG-SEC-006 Phase 2 — directive-exact copy for stale dynamic passes.
const EXPIRED_TOKEN_MESSAGE = "EXPIRED TOKEN";

/**
 * RSG-ENG-SEC-006 Phase 1 — per-ticket in-instance serialization. Two staff
 * devices hitting this fork in the same millisecond queue behind each other;
 * the CAS in checkIn*Ticket() then guarantees a single admission.
 */
const gateLocks = new Map<string, Promise<void>>();

async function withTicketLock(
  ticketId: string,
  run: () => Promise<NextResponse>,
): Promise<NextResponse> {
  const prev = gateLocks.get(ticketId) ?? Promise.resolve();
  let release!: () => void;
  const done = new Promise<void>((resolve) => {
    release = resolve;
  });
  const tail = prev.then(
    () => done,
    () => done,
  );
  gateLocks.set(ticketId, tail);
  await prev.catch(() => undefined);
  try {
    return await run();
  } finally {
    release();
    if (gateLocks.get(ticketId) === tail) gateLocks.delete(ticketId);
  }
}

function resolveTicket(ticketId: string) {
  return ticketById(ticketId) || findTicket(ticketId);
}

function tokenRejected(
  ticket: IssuedTicket,
  raw: string,
  scannedAt?: string,
): ScanValidateResponse | null {
  if (!ticket.qrToken) return null;
  const parsed = parseTicketPayload(raw);

  // v2 dynamic payload (RSG-ENG-SEC-006 Phase 2): HS86.<id>.<nonce>.<counter>.<sig>
  if (parsed.signed && parsed.counter !== undefined && parsed.nonce && parsed.signature) {
    if (parsed.nonce !== ticket.qrToken) {
      return {
        verdict: "transferred",
        revoked: true,
        ticketId: ticket.ticketId,
        attendeeName: ticket.attendeeName,
        tier: ticket.tier,
        eventName: ticket.eventName,
        message: TRANSFER_VOID_MESSAGE,
        statusLabel: TRANSFER_VOID_STATUS,
        passIndex: ticket.passIndex,
        passTotal: ticket.passTotal,
      };
    }
    if (!verifyTotpPayload(ticket.ticketId, ticket.qrToken, parsed.counter, parsed.signature)) {
      return {
        verdict: "invalid",
        revoked: true,
        ticketId: ticket.ticketId,
        message: "QR signature is not valid",
        passIndex: ticket.passIndex,
        passTotal: ticket.passTotal,
      };
    }
    const withinWindow = Math.abs(parsed.counter - totpCounter()) <= 1;
    // Delayed-sync binding: offline-queued scans replay later with their
    // ORIGINAL scannedAt — accept a stale counter when its signature matches
    // the step the scan actually happened in (same replay exposure class as
    // today's static v1 tokens, but time-bounded).
    const scannedMs = scannedAt ? Date.parse(scannedAt) : Number.NaN;
    const replayBound =
      Number.isFinite(scannedMs) &&
      Math.abs(parsed.counter - totpCounter(scannedMs)) <= 1;
    if (!withinWindow && !replayBound) {
      return {
        verdict: "expired",
        revoked: true,
        ticketId: ticket.ticketId,
        attendeeName: ticket.attendeeName,
        tier: ticket.tier,
        eventName: ticket.eventName,
        message: EXPIRED_TOKEN_MESSAGE,
        statusLabel: EXPIRED_TOKEN_MESSAGE,
        passIndex: ticket.passIndex,
        passTotal: ticket.passTotal,
      };
    }
    return null;
  }

  // v1 static payload — unchanged behavior (offline IDB manifest fallback).
  if (parsed.signed && parsed.nonce && parsed.signature) {
    if (!verifyHs86Payload(parsed.ticketId, parsed.nonce, parsed.signature)) {
      return {
        verdict: "invalid",
        revoked: true,
        ticketId: ticket.ticketId,
        message: "QR signature is not valid",
        passIndex: ticket.passIndex,
        passTotal: ticket.passTotal,
      };
    }
  }
  if (!parsed.nonce || parsed.nonce !== ticket.qrToken) {
    return {
      verdict: "transferred",
      revoked: true,
      ticketId: ticket.ticketId,
      attendeeName: ticket.attendeeName,
      tier: ticket.tier,
      eventName: ticket.eventName,
      message: TRANSFER_VOID_MESSAGE,
      statusLabel: TRANSFER_VOID_STATUS,
      passIndex: ticket.passIndex,
      passTotal: ticket.passTotal,
    };
  }
  return null;
}

/**
 * Verify a self-contained HS86 QR when the server's ticket ledger is absent.
 * This proves the QR was minted by this app. The token does not encode event,
 * current transfer ownership, or prior-use state, so this emergency path uses
 * a local CAS ledger; unsigned FooEvents IDs must instead exist in the trusted
 * scanner manifest before the client can admit them.
 */
function verifyRawScanSignature(ticketId: string, raw: string): boolean {
  const parsed = parseTicketPayload(raw);
  if (!parsed.signed || parsed.ticketId !== ticketId || !parsed.nonce || !parsed.signature) {
    return false;
  }
  if (parsed.counter !== undefined) {
    if (!verifyTotpPayload(ticketId, parsed.nonce, parsed.counter, parsed.signature)) return false;
    // A signature-only emergency admission must be live now; unlike normal
    // local-ledger replay, do not let a client-supplied scannedAt revive an
    // expired TOTP when there is no current ticket row to bind it to.
    return Math.abs(parsed.counter - totpCounter()) <= 1;
  }
  return verifyHs86Payload(ticketId, parsed.nonce, parsed.signature);
}

export async function POST(request: Request) {
  try {
    return await handlePost(request);
  } catch (err) {
    console.error("[hs86e] /api/scan/validate recovered from unexpected failure:", err);
    return NextResponse.json(
      {
        verdict: "invalid",
        ticketId: "",
        message: "Verification service is temporarily unavailable — check the manifest and retry.",
      } satisfies ScanValidateResponse,
      { status: 503 },
    );
  }
}

async function handlePost(request: Request) {
  const session = await getStaffSessionFromCookies();
  if (!session) {
    return NextResponse.json({ error: "Staff session required" }, { status: 401 });
  }

  const json = await request.json().catch(() => null);
  const parsed = schema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid scan payload" }, { status: 400 });
  }

  const raw = parsed.data.ticketId;
  const ticketId = decodeTicketPayload(raw);
  if (!ticketId || !isTicketIdShape(ticketId)) {
    return NextResponse.json({ error: "Invalid scan payload" }, { status: 400 });
  }

  const { eventId, deviceId, scannedAt } = parsed.data;
  const when = scannedAt || new Date().toISOString();

  const local = resolveTicket(ticketId);

  if (local) {
    const revoked = tokenRejected(local, raw, scannedAt);
    if (revoked) return NextResponse.json(revoked);

    if (local.eventId && eventId && local.eventId !== eventId) {
      return NextResponse.json({
        verdict: "invalid",
        ticketId,
        attendeeName: local.attendeeName,
        tier: local.tier,
        eventName: local.eventName,
        message: "Wrong event",
        passIndex: local.passIndex,
        passTotal: local.passTotal,
      } satisfies ScanValidateResponse);
    }
    if (local.status === "Canceled" || local.status === "Unpaid") {
      return NextResponse.json({
        verdict: "canceled",
        ticketId,
        attendeeName: local.attendeeName,
        tier: local.tier,
        eventName: local.eventName,
        message: local.status === "Unpaid" ? "Ticket unpaid" : "Ticket canceled",
        passIndex: local.passIndex,
        passTotal: local.passTotal,
      } satisfies ScanValidateResponse);
    }
    // RSG-ENG-SEC-006 Phase 1 — serialize the state change per ticketId and
    // CAS the status flip so two staff devices scanning the same pass at the
    // same instant cannot both admit it.
    return await withTicketLock(ticketId, async () => {
      const fresh = resolveTicket(ticketId);
      if (fresh?.status === "Checked In") {
        return NextResponse.json({
          verdict: "duplicate",
          ticketId,
          attendeeName: fresh.attendeeName,
          attendeeEmail: fresh.attendeeEmail,
          attendeePhone: fresh.attendeePhone,
          tier: fresh.tier,
          eventName: fresh.eventName,
          checkedInAt: fresh.checkedInAt,
          message: passMessage(fresh, true),
          passIndex: fresh.passIndex,
          passTotal: fresh.passTotal,
        } satisfies ScanValidateResponse);
      }

      // CAS: exactly one caller can flip this pass to Checked In.
      const ledgerCas = checkInLedgerTicket(ticketId, when);
      const demoCas = checkInDemoTicket(ticketId, when);
      if (!ledgerCas.transitioned && !demoCas.transitioned) {
        const seen = fresh ?? local;
        return NextResponse.json({
          verdict: "duplicate",
          ticketId,
          attendeeName: seen.attendeeName,
          attendeeEmail: seen.attendeeEmail,
          attendeePhone: seen.attendeePhone,
          tier: seen.tier,
          eventName: seen.eventName,
          checkedInAt: seen.checkedInAt,
          message: passMessage(seen, true),
          passIndex: seen.passIndex,
          passTotal: seen.passTotal,
        } satisfies ScanValidateResponse);
      }

      const checked = ledgerCas.ticket ?? demoCas.ticket ?? local;
      const siblings = ticketsForOrder(checked.orderId);
      const total = checked.passTotal || siblings.length || 1;
      const index = checked.passIndex || 1;
      return NextResponse.json({
        verdict: "valid",
        ticketId,
        attendeeName: checked.attendeeName,
        attendeeEmail: checked.attendeeEmail,
        attendeePhone: checked.attendeePhone,
        tier: checked.tier,
        eventName: checked.eventName,
        checkedInAt: when,
        message: `Ticket ${index} of ${total} checked in`,
        passIndex: index,
        passTotal: total,
      } satisfies ScanValidateResponse);
    });
  }

  if (isDemoMode()) {
    return NextResponse.json({
      verdict: "invalid",
      ticketId,
      message: "Ticket not found",
    } satisfies ScanValidateResponse);
  }

  // A ticket WordPress refused to record (403 capability gap) was admitted
  // locally. It is NOT in FooEvents, so WP cannot report it as a duplicate —
  // the fallback ledger is the only authority for that re-scan.
  const localFallback = getFallbackCheckin(ticketId);
  if (localFallback) {
    return NextResponse.json({
      verdict: "duplicate",
      ticketId,
      attendeeName: localFallback.attendeeName,
      eventName: localFallback.eventName,
      checkedInAt: localFallback.checkedInAt,
      wpSyncPending: !localFallback.synced,
      message: "ALREADY SCANNED / ADMISSION DENIED",
    } satisfies ScanValidateResponse);
  }

  return await withTicketLock(ticketId, async () => {
    const result = await checkInTicket({ ticketId, eventId, deviceId, scannedAt: when });

    // If the WP read is blocked too, an authentic HS86-signed QR is still
    // cryptographic proof that this app issued the pass. Record it with CAS so
    // a re-scan on this function instance becomes a duplicate. Plain, unknown
    // FooEvents IDs still need a trusted local manifest (client-side fallback).
    if (result.wpPermissionDenied && !result.wpBlocked403 && verifyRawScanSignature(ticketId, raw)) {
      const recorded = recordFallbackCheckin({
        ticketId,
        eventId,
        checkedInAt: when,
        deviceId,
        attendeeName: result.ticket?.attendeeName || "Verified ticket holder",
        eventName: result.ticket?.eventName,
        synced: false,
        wpDetail: "HTTP 403 — app HMAC/TOTP verified while FooEvents permission check was blocked",
      });
      if (!recorded) {
        const previous = getFallbackCheckin(ticketId);
        return NextResponse.json({
          verdict: "duplicate",
          ticketId,
          attendeeName: previous?.attendeeName || "Verified ticket holder",
          eventName: previous?.eventName,
          checkedInAt: previous?.checkedInAt,
          wpSyncPending: Boolean(previous && !previous.synced),
          message: "ALREADY SCANNED / ADMISSION DENIED",
        } satisfies ScanValidateResponse);
      }
      return NextResponse.json({
        verdict: "valid",
        ticketId,
        attendeeName: result.ticket?.attendeeName || "Verified ticket holder",
        eventName: result.ticket?.eventName,
        checkedInAt: when,
        wpSyncPending: true,
        signatureVerified: true,
        message: "QR signature verified — checked in locally; WordPress blocked the write (403). Remote sync is queued.",
      } satisfies ScanValidateResponse);
    }

    if (result.verdict === "valid" && result.wpBlocked403) {
      // CAS: only one of the racing staff devices records (and admits) it.
      const recorded = recordFallbackCheckin({
        ticketId,
        eventId,
        checkedInAt: when,
        deviceId,
        attendeeName: result.ticket?.attendeeName,
        eventName: result.ticket?.eventName,
        synced: false,
        wpDetail: "HTTP 403 — FooEvents capability check refused the check-in write",
      });
      if (!recorded) {
        return NextResponse.json({
          verdict: "duplicate",
          ticketId,
          attendeeName: result.ticket?.attendeeName,
          eventName: result.ticket?.eventName,
          wpSyncPending: true,
          message: "ALREADY SCANNED / ADMISSION DENIED",
        } satisfies ScanValidateResponse);
      }
      return NextResponse.json({
        verdict: "valid",
        ticketId,
        attendeeName: result.ticket?.attendeeName,
        attendeeEmail: result.ticket?.attendeeEmail,
        attendeePhone: result.ticket?.attendeePhone,
        tier: result.ticket?.tier,
        eventName: result.ticket?.eventName,
        checkedInAt: when,
        wpSyncPending: true,
        message: result.message,
      } satisfies ScanValidateResponse);
    }

    return NextResponse.json({
      verdict: result.verdict,
      ticketId,
      attendeeName: result.ticket?.attendeeName,
      attendeeEmail: result.ticket?.attendeeEmail,
      attendeePhone: result.ticket?.attendeePhone,
      tier: result.ticket?.tier,
      eventName: result.ticket?.eventName,
      checkedInAt: result.ticket?.checkedInAt || (result.verdict === "valid" ? when : undefined),
      wpPermissionDenied: result.wpPermissionDenied,
      signatureVerified: result.wpPermissionDenied ? verifyRawScanSignature(ticketId, raw) : undefined,
      message: result.verdict === "duplicate" ? "ALREADY SCANNED / ADMISSION DENIED" : result.message,
    } satisfies ScanValidateResponse);
  });
}
