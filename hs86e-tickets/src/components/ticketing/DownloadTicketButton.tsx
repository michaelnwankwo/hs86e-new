"use client";

import { useState } from "react";
import { Download } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { LOGO_PATH } from "@/lib/constants";
import type { IssuedTicket } from "@/lib/types";

export function DownloadTicketButton({
  ticket,
  svgSelector,
}: {
  ticket: IssuedTicket;
  svgSelector: string;
}) {
  const [busy, setBusy] = useState(false);

  async function download() {
    setBusy(true);
    try {
      const svg = document.querySelector(svgSelector) as SVGSVGElement | null;
      const canvas = document.createElement("canvas");
      canvas.width = 1080;
      canvas.height = 1680;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      ctx.fillStyle = "#0B0E14";
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      const glow = ctx.createRadialGradient(540, 280, 20, 540, 280, 420);
      glow.addColorStop(0, "rgba(223,178,96,0.22)");
      glow.addColorStop(1, "rgba(11,14,20,0)");
      ctx.fillStyle = glow;
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      ctx.strokeStyle = "rgba(223,178,96,0.35)";
      ctx.lineWidth = 4;
      ctx.strokeRect(48, 48, canvas.width - 96, canvas.height - 96);

      await drawImage(ctx, LOGO_PATH, 340, 80, 400, 266);

      ctx.fillStyle = "#F5D68D";
      ctx.font = "600 28px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("HOT SINCE 86 ENTERTAINMENT", 540, 390);

      ctx.fillStyle = "#F8FAFC";
      ctx.font = "700 52px Georgia";
      ctx.fillText(ticket.eventName, 540, 470);

      ctx.fillStyle = "#DFB260";
      ctx.font = "600 28px sans-serif";
      ctx.fillText(ticket.tier.toUpperCase(), 540, 520);

      if (svg) {
        const xml = new XMLSerializer().serializeToString(svg);
        const blob = new Blob([xml], { type: "image/svg+xml;charset=utf-8" });
        const url = URL.createObjectURL(blob);
        await drawImage(ctx, url, 250, 560, 580, 580);
        URL.revokeObjectURL(url);
      }

      ctx.fillStyle = "#F8FAFC";
      ctx.font = "600 34px sans-serif";
      ctx.fillText(ticket.attendeeName, 540, 1220);
      ctx.fillStyle = "#94A3B8";
      ctx.font = "500 24px sans-serif";
      ctx.fillText(ticket.ticketId, 540, 1270);
      ctx.fillText(ticket.venueName, 540, 1320);

      const a = document.createElement("a");
      a.href = canvas.toDataURL("image/png");
      a.download = `HS86E-${ticket.ticketId}.png`;
      a.click();
    } finally {
      setBusy(false);
    }
  }

  return (
    <Button variant="ghost" block onClick={() => void download()} disabled={busy}>
      <Download className="h-4 w-4" />
      {busy ? "Preparing…" : "Save to device"}
    </Button>
  );
}

function drawImage(
  ctx: CanvasRenderingContext2D,
  src: string,
  x: number,
  y: number,
  w: number,
  h: number,
) {
  return new Promise<void>((resolve) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      ctx.drawImage(img, x, y, w, h);
      resolve();
    };
    img.onerror = () => resolve();
    img.src = src;
  });
}
