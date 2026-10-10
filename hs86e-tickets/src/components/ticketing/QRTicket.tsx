"use client";

import { QRCodeSVG } from "qrcode.react";
import { useEffect, useRef, useState } from "react";
import { encodeTicketPayload } from "@/lib/ticket-payload";
import {
  buildV2Payload,
  importTotpKey,
  signTotpCounter,
  totpCounter,
} from "@/lib/pass-security";
import type { IssuedTicket } from "@/lib/types";

/**
 * Renders the pass QR.
 *
 * RSG-ENG-SEC-006 Phase 2: when the ticket carries a holder-only `totpSeed`
 * and its `qrToken` nonce, the QR becomes a v2 dynamic payload
 * (`HS86.<id>.<nonce>.<counter>.<sig>`) re-signed every 30 s counter step
 * with a non-extractable WebCrypto key. Without a seed (legacy stored
 * tickets, offline wallet) it falls back to the server-signed static v1
 * payload — full backwards compatibility.
 */
export function QRTicket({
  ticketId,
  ticket,
  size = 280,
}: {
  ticketId?: string;
  ticket?: Pick<IssuedTicket, "ticketId" | "orderId" | "qrPayload" | "qrToken" | "totpSeed">;
  size?: number;
}) {
  const id = ticket?.ticketId || ticketId || "";
  const staticPayload = ticket ? encodeTicketPayload(ticket) : id;
  const seed = ticket?.totpSeed;
  const nonce = ticket?.qrToken;
  const dynamic = Boolean(id && seed && nonce);

  const [payload, setPayload] = useState<string | null>(null);
  const keyRef = useRef<CryptoKey | null>(null);
  const lastCounterRef = useRef<number | null>(null);

  useEffect(() => {
    if (!dynamic || !seed || !nonce) {
      setPayload(null);
      keyRef.current = null;
      lastCounterRef.current = null;
      return;
    }
    let cancelled = false;

    const tick = async () => {
      try {
        const counter = totpCounter();
        if (keyRef.current && lastCounterRef.current === counter) return;
        keyRef.current ??= await importTotpKey(seed);
        const signature = await signTotpCounter(keyRef.current, id, nonce, counter);
        lastCounterRef.current = counter;
        if (!cancelled) setPayload(buildV2Payload(id, nonce, counter, signature));
      } catch {
        // WebCrypto unavailable / bad seed — degrade to the static v1 QR.
        keyRef.current = null;
        lastCounterRef.current = null;
        if (!cancelled) setPayload(null);
      }
    };

    tick();
    const timer = window.setInterval(tick, 1000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [dynamic, id, nonce, seed]);

  if (!id) {
    return (
      <div className="mx-auto grid h-[240px] w-[240px] place-items-center rounded-2xl bg-white text-sm text-[#0B0E14]">
        Preparing pass…
      </div>
    );
  }

  const value = dynamic ? (payload ?? staticPayload) : staticPayload;

  return (
    <div className="mx-auto w-fit rounded-2xl bg-white p-3">
      <QRCodeSVG
        value={value}
        size={size}
        level="H"
        includeMargin={false}
        bgColor="#ffffff"
        fgColor="#0B0E14"
      />
    </div>
  );
}
