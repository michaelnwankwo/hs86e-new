#!/usr/bin/env node
/**
 * Transfer + door-scan security assertions.
 * Requires the Next.js dev server on PORT (default 3000).
 */
import { createHmac, randomBytes } from "node:crypto";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const BASE = process.env.TEST_BASE_URL || "http://127.0.0.1:3000";
const PIN = process.env.SCAN_STAFF_PIN || "8686";
const VOID_STATUS = "TRANSFERRED / VOID";
const VOID_MESSAGE =
  "This pass was transferred to another user. Original QR is no longer valid.";

const failed = [];
const passed = [];

function assert(name, condition, detail) {
  if (condition) {
    passed.push(name);
    console.log(`  PASS  ${name}`);
  } else {
    failed.push(name);
    console.error(`  FAIL  ${name}${detail ? ` — ${detail}` : ""}`);
  }
}

function loadEnv() {
  const env = {};
  try {
    for (const line of readFileSync(join(ROOT, ".env.local"), "utf8").split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eq = trimmed.indexOf("=");
      if (eq < 0) continue;
      env[trimmed.slice(0, eq)] = trimmed.slice(eq + 1);
    }
  } catch {
    // missing .env.local
  }
  return env;
}

function parseHs86(raw) {
  const value = String(raw || "").trim();
  if (value.startsWith("HS86.")) {
    const parts = value.split(".");
    if (parts.length === 4) {
      return { ticketId: parts[1], nonce: parts[2], signature: parts[3], signed: true };
    }
  }
  return { ticketId: value, signed: false };
}

function sign(ticketId, nonce, secret) {
  const sig = createHmac("sha256", secret).update(`${ticketId}.${nonce}`).digest("base64url").slice(0, 22);
  return `HS86.${ticketId}.${nonce}.${sig}`;
}

function seedTicket({ ticketId, email, secret, eventId = "1001" }) {
  const nonce = randomBytes(12).toString("base64url");
  const qrPayload = sign(ticketId, nonce, secret);
  const ticket = {
    ticketId,
    attendeeName: "Adaeze Okonkwo",
    attendeeEmail: email,
    attendeePhone: "+2348012345678",
    tier: "VIP",
    eventId,
    eventName: "Lagos After Dark",
    eventSlug: "lagos-after-dark",
    venueName: "Eko Atlantic Pavilion",
    startsAt: "2026-09-19T21:00:00+01:00",
    status: "Not Checked In",
    orderId: Number(String(ticketId).replace(/\D/g, "").slice(0, 6) || "8602"),
    orderKey: "ok-security-suite",
    passIndex: 2,
    passTotal: 8,
    purchaserEmail: email,
    assignedEmail: email,
    qrToken: nonce,
    qrPayload,
    holder: true,
  };
  const file = join(ROOT, ".data", "issued-tickets.json");
  mkdirSync(join(ROOT, ".data"), { recursive: true });
  let ledger = { tickets: [], transfers: [] };
  try {
    ledger = JSON.parse(readFileSync(file, "utf8"));
  } catch {
    // new ledger
  }
  ledger.tickets = (ledger.tickets || []).filter((row) => row.ticketId !== ticketId);
  ledger.tickets.push(ticket);
  writeFileSync(file, JSON.stringify(ledger, null, 2));
  return ticket;
}

async function json(res) {
  const text = await res.text();
  try {
    return { status: res.status, body: JSON.parse(text) };
  } catch {
    return { status: res.status, body: { raw: text } };
  }
}

async function main() {
  console.log(`HS86E transfer security suite → ${BASE}\n`);

  const env = loadEnv();
  const secret = env.SCAN_JWT_SECRET;
  assert("SCAN_JWT_SECRET is configured", Boolean(secret && secret.length >= 24));

  const health = await fetch(`${BASE}/api/health`).catch((err) => {
    throw new Error(`Dev server not reachable at ${BASE}: ${err.message}`);
  });
  assert("dev server /api/health", health.ok, `status ${health.status}`);

  // --- payload parser ---
  const sample = sign("TKT-8602-02", "nonceTest12ab", secret);
  const parsed = parseHs86(sample);
  assert("parse HS86 ticketId", parsed.ticketId === "TKT-8602-02");
  assert("parse HS86 nonce", parsed.nonce === "nonceTest12ab");
  assert("parse HS86 signed flag", parsed.signed === true);

  const ticketId = `TKT-8602-${String(Date.now()).slice(-2)}`;
  const buyer = "buyer.suite@hs86e.test";
  const guest = "guest.suite@hs86e.test";
  const seeded = seedTicket({ ticketId, email: buyer, secret });
  const oldPayload = seeded.qrPayload;

  const lookup = await json(await fetch(`${BASE}/api/tickets?ticketId=${encodeURIComponent(ticketId)}`));
  assert("claim URL lookup 200", lookup.status === 200);
  assert("claim URL returns this pass", lookup.body.tickets?.[0]?.ticketId === ticketId);
  assert("claim URL exposes live QR", Boolean(lookup.body.tickets?.[0]?.qrPayload));
  assert("claim URL QR matches seed", lookup.body.tickets?.[0]?.qrPayload === oldPayload);
  assert("claim URL holder=true", lookup.body.tickets?.[0]?.holder === true);

  const transfer = await json(
    await fetch(`${BASE}/api/tickets/transfer`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        ticketId,
        fromEmail: buyer,
        toEmail: guest,
        toName: "Guest Suite",
      }),
    }),
  );
  assert("transfer 200", transfer.status === 200, JSON.stringify(transfer.body));
  assert("transfer rotates QR", Boolean(transfer.body.ticket?.qrPayload) && transfer.body.ticket.qrPayload !== oldPayload);
  assert("transfer keeps ticket id", transfer.body.ticket?.ticketId === ticketId);
  assert("transfer assigns guest", transfer.body.ticket?.assignedEmail === guest);
  assert(
    "claimUrl uses ticketId query",
    String(transfer.body.claimUrl || "").includes(`ticketId=${ticketId}`),
  );

  const newPayload = transfer.body.ticket.qrPayload;
  assert("new payload still HS86 signed", newPayload.startsWith("HS86."));
  assert("old nonce != new nonce", parseHs86(oldPayload).nonce !== parseHs86(newPayload).nonce);

  const guestLookup = await json(await fetch(`${BASE}/api/tickets?email=${encodeURIComponent(guest)}`));
  assert("guest email lookup 200", guestLookup.status === 200);
  const guestPass = guestLookup.body.tickets?.find((t) => t.ticketId === ticketId);
  assert("guest receives pass", Boolean(guestPass));
  assert("guest sees rotated QR", guestPass?.qrPayload === newPayload);
  assert("guest is holder", guestPass?.holder === true);

  const buyerLookup = await json(await fetch(`${BASE}/api/tickets?email=${encodeURIComponent(buyer)}`));
  const buyerPass = buyerLookup.body.tickets?.find((t) => t.ticketId === ticketId);
  assert("buyer still sees stub", Boolean(buyerPass));
  assert("buyer QR redacted", !buyerPass?.qrPayload && !buyerPass?.qrToken);
  assert("buyer holder=false", buyerPass?.holder === false);
  assert("buyer transferredTo=guest", buyerPass?.transferredTo === guest);

  const claimAfter = await json(await fetch(`${BASE}/api/tickets?ticketId=${encodeURIComponent(ticketId)}`));
  assert("guest claim URL has new QR", claimAfter.body.tickets?.[0]?.qrPayload === newPayload);
  assert("guest claim URL expanded holder", claimAfter.body.tickets?.[0]?.holder === true);

  const forbidden = await json(
    await fetch(`${BASE}/api/tickets/transfer`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ ticketId, fromEmail: buyer, toEmail: "other@hs86e.test" }),
    }),
  );
  assert("original buyer cannot re-transfer", forbidden.status === 403);

  const same = await json(
    await fetch(`${BASE}/api/tickets/transfer`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ ticketId, fromEmail: guest, toEmail: guest }),
    }),
  );
  assert("same-email transfer rejected", same.status === 400);

  const auth = await fetch(`${BASE}/api/scan/auth`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ pin: PIN }),
  });
  const setCookie = auth.headers.get("set-cookie") || "";
  const cookie = setCookie.split(";")[0];
  assert("staff PIN accepted", auth.ok && Boolean(cookie), `status ${auth.status}`);

  async function scan(payload) {
    let lastErr;
    for (let attempt = 0; attempt < 3; attempt += 1) {
      try {
        return await json(
          await fetch(`${BASE}/api/scan/validate`, {
            method: "POST",
            headers: {
              "content-type": "application/json",
              cookie: cookie || "",
            },
            body: JSON.stringify({
              ticketId: payload,
              eventId: "1001",
              deviceId: "door-suite",
              scannedAt: new Date().toISOString(),
            }),
          }),
        );
      } catch (err) {
        lastErr = err;
        await new Promise((resolve) => setTimeout(resolve, 400 * (attempt + 1)));
      }
    }
    throw lastErr;
  }

  const voided = await scan(oldPayload);
  assert("old QR HTTP 200 (verdict, not 5xx)", voided.status === 200, JSON.stringify(voided.body));
  assert("old QR verdict=transferred", voided.body.verdict === "transferred", JSON.stringify(voided.body));
  assert("old QR status TRANSFERRED / VOID", voided.body.statusLabel === VOID_STATUS);
  assert("old QR exact void message", voided.body.message === VOID_MESSAGE);
  assert("old QR did not check in", voided.body.verdict !== "valid");

  const live = await scan(newPayload);
  assert("new QR verdict=valid", live.body.verdict === "valid", JSON.stringify(live.body));
  assert("new QR checks in pass 2 of 8", live.body.passIndex === 2 && live.body.passTotal === 8);

  const replayOld = await scan(oldPayload);
  assert("old QR still transferred after check-in", replayOld.body.verdict === "transferred");
  assert("replay keeps void copy", replayOld.body.message === VOID_MESSAGE);

  const tampered = newPayload.slice(0, -2) + "xx";
  const badSig = await scan(tampered);
  assert("tampered HMAC is invalid (not valid)", badSig.body.verdict === "invalid" || badSig.body.verdict === "transferred");

  const sibling = seedTicket({
    ticketId: ticketId.replace(/-(\d{2})$/, "-01"),
    email: buyer,
    secret,
  });
  const siblingScan = await scan(sibling.qrPayload);
  assert("sibling pass still valid after transfer of pass 02", siblingScan.body.verdict === "valid", JSON.stringify(siblingScan.body));

  console.log(`\n${passed.length} passed, ${failed.length} failed`);
  if (failed.length) {
    console.error("Failed:", failed.join(", "));
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
