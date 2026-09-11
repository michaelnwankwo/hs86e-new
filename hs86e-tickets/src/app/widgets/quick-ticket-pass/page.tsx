"use client";

import { useEffect, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { ACTIVE_TICKET_KEY } from "@/lib/widget-storage";

interface ActiveTicket {
  ticketId: string;
  eventName: string;
  tier: string;
  attendeeName: string;
  passIndex?: number;
  passTotal?: number;
  qrPayload: string;
  savedAt: string;
}

export default function QuickTicketPassWidget() {
  const [ticket, setTicket] = useState<ActiveTicket | null>(null);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(ACTIVE_TICKET_KEY);
      if (raw) setTicket(JSON.parse(raw) as ActiveTicket);
    } catch {
      setTicket(null);
    }
  }, []);

  return (
    <main
      style={{
        minHeight: "100dvh",
        background: "#0B0E14",
        color: "#F8FAFC",
        fontFamily: "Georgia, 'Times New Roman', serif",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: 24,
        textAlign: "center",
      }}
    >
      <p style={{ color: "#DFB260", fontSize: 11, letterSpacing: "0.22em", textTransform: "uppercase", margin: 0 }}>
        Hot Since 86 Entertainment
      </p>
      {ticket?.qrPayload ? (
        <>
          <h1 style={{ fontSize: 22, fontWeight: 600, margin: "12px 0 4px" }}>{ticket.eventName}</h1>
          <p style={{ color: "#F5D68D", fontSize: 14, margin: "0 0 16px" }}>
            {ticket.tier}
            {ticket.passIndex && ticket.passTotal ? ` · Pass ${ticket.passIndex} of ${ticket.passTotal}` : ""}
          </p>
          <div style={{ background: "#ffffff", borderRadius: 16, padding: 12 }}>
            <QRCodeSVG value={ticket.qrPayload} size={200} level="H" bgColor="#ffffff" fgColor="#0B0E14" />
          </div>
          <p style={{ color: "#F8FAFC", fontSize: 14, margin: "14px 0 0" }}>{ticket.attendeeName}</p>
          <p style={{ color: "#94A3B8", fontSize: 11, margin: "6px 0 0" }}>{ticket.ticketId}</p>
        </>
      ) : (
        <p style={{ color: "#94A3B8", fontSize: 14 }}>
          No active pass yet. Open HS86E Tickets and look up your tickets.
        </p>
      )}
    </main>
  );
}
