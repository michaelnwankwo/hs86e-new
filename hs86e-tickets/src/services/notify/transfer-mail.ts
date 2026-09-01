import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { getEnv } from "@/lib/env";
import type { IssuedTicket } from "@/lib/types";

export async function sendTransferEmail(input: {
  to: string;
  fromName: string;
  claimUrl: string;
  ticket: IssuedTicket;
}): Promise<{ sent: boolean; method: "resend" | "outbox" }> {
  const passLabel =
    input.ticket.passIndex && input.ticket.passTotal
      ? `Pass ${input.ticket.passIndex} of ${input.ticket.passTotal}`
      : "Pass";
  const subject = `Your HS86E ${passLabel} · ${input.ticket.eventName}`;
  const text = [
    `You've been sent an HS86E pass.`,
    ``,
    `Event: ${input.ticket.eventName}`,
    `${passLabel}`,
    `Ticket ID: ${input.ticket.ticketId}`,
    input.ticket.venueName ? `Venue: ${input.ticket.venueName}` : "",
    ``,
    `Open your pass: ${input.claimUrl}`,
    `Or open HS86E Tickets → Find my tickets → enter this email.`,
    ``,
    `The previous QR is void. Only this new pass is valid at the door.`,
  ]
    .filter(Boolean)
    .join("\n");

  const html = `<!doctype html>
<html>
<body style="margin:0;background:#0B0E14;color:#F8FAFC;font-family:Georgia,serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#0B0E14;padding:32px 16px;">
    <tr><td align="center">
      <table role="presentation" width="520" cellpadding="0" cellspacing="0" style="background:#161B22;border:1px solid rgba(223,178,96,0.25);border-radius:20px;padding:28px;">
        <tr><td style="font-size:11px;letter-spacing:0.22em;text-transform:uppercase;color:#DFB260;">Hot Since 86 Entertainment</td></tr>
        <tr><td style="padding-top:12px;font-size:26px;color:#F8FAFC;">You're on the list</td></tr>
        <tr><td style="padding-top:10px;color:#F5D68D;font-size:16px;">${escapeHtml(input.ticket.eventName)}</td></tr>
        <tr><td style="padding-top:16px;color:#94A3B8;font-size:14px;line-height:1.6;">
          ${escapeHtml(input.fromName || "A guest")} transferred ${escapeHtml(passLabel).toLowerCase()} to you.
          Your Ticket ID is <span style="color:#F5D68D;font-family:ui-monospace,monospace;">${escapeHtml(input.ticket.ticketId)}</span>.
        </td></tr>
        <tr><td style="padding-top:22px;">
          <a href="${escapeHtml(input.claimUrl)}" style="display:inline-block;background:#043927;color:#F8FAFC;text-decoration:none;padding:14px 22px;border-radius:12px;font-family:system-ui,sans-serif;font-weight:600;">
            Open my pass
          </a>
        </td></tr>
        <tr><td style="padding-top:18px;color:#64748B;font-size:12px;line-height:1.5;">
          The old QR is void. Show this new pass at the door. Keep this email or save the ticket in your HS86E wallet.
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;

  writeOutbox({
    to: input.to,
    subject,
    text,
    html,
    ticketId: input.ticket.ticketId,
    claimUrl: input.claimUrl,
  });

  const env = getEnv();
  if (env.RESEND_API_KEY) {
    try {
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${env.RESEND_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: env.RESEND_FROM || "HS86E Tickets <tickets@hotsince86ent.com>",
          to: [input.to],
          subject,
          text,
          html,
        }),
      });
      if (res.ok) return { sent: true, method: "resend" };
    } catch {
      // fall through to outbox
    }
  }

  return { sent: false, method: "outbox" };
}

function writeOutbox(payload: {
  to: string;
  subject: string;
  text: string;
  html: string;
  ticketId: string;
  claimUrl: string;
}) {
  const dir = join(process.cwd(), ".data", "outbox");
  mkdirSync(dir, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const safeId = payload.ticketId.replace(/[^A-Za-z0-9_-]/g, "_");
  writeFileSync(
    join(dir, `${stamp}-${safeId}.json`),
    JSON.stringify({ ...payload, createdAt: new Date().toISOString() }, null, 2),
    "utf8",
  );
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
