"use client";

import { QRCodeSVG } from "qrcode.react";
import { encodeTicketPayload } from "@/lib/ticket-payload";
import type { IssuedTicket } from "@/lib/types";

export function QRTicket({
  ticketId,
  ticket,
  size = 280,
}: {
  ticketId?: string;
  ticket?: Pick<IssuedTicket, "ticketId" | "orderId" | "qrPayload">;
  size?: number;
}) {
  const id = ticket?.ticketId || ticketId || "";
  if (!id) {
    return (
      <div className="mx-auto grid h-[240px] w-[240px] place-items-center rounded-2xl bg-white text-sm text-[#0B0E14]">
        Preparing pass…
      </div>
    );
  }

  const payload = encodeTicketPayload(ticket ?? { ticketId: id, orderId: 0 });

  return (
    <div className="mx-auto w-fit rounded-2xl bg-white p-3">
      <QRCodeSVG
        value={payload}
        size={size}
        level="H"
        includeMargin={false}
        bgColor="#ffffff"
        fgColor="#0B0E14"
      />
    </div>
  );
}
