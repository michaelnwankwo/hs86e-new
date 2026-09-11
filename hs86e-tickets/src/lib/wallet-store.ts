"use client";

import type { IssuedTicket } from "@/lib/types";
import { WALLET_KEY, WALLET_KEY_LEGACY } from "@/lib/constants";
import { safeJson } from "@/lib/utils";

function readKey(key: string): IssuedTicket[] {
  return safeJson<IssuedTicket[]>(window.localStorage.getItem(key), []).filter(
    (ticket) => ticket.ticketId,
  );
}

export function readWallet(): IssuedTicket[] {
  if (typeof window === "undefined") return [];
  const current = readKey(WALLET_KEY);
  const legacy = readKey(WALLET_KEY_LEGACY);
  if (legacy.length === 0) return current;
  const map = new Map(current.map((ticket) => [ticket.ticketId, ticket]));
  for (const ticket of legacy) map.set(ticket.ticketId, ticket);
  const merged = [...map.values()];
  window.localStorage.setItem(WALLET_KEY, JSON.stringify(merged));
  window.localStorage.removeItem(WALLET_KEY_LEGACY);
  return merged;
}

export function writeWallet(tickets: IssuedTicket[]) {
  if (typeof window === "undefined") return;
  const current = readWallet();
  const map = new Map(current.map((ticket) => [ticket.ticketId, ticket]));
  for (const ticket of tickets) {
    if (ticket.ticketId) map.set(ticket.ticketId, ticket);
  }
  window.localStorage.setItem(WALLET_KEY, JSON.stringify([...map.values()]));
}

export function replaceWallet(tickets: IssuedTicket[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(WALLET_KEY, JSON.stringify(tickets.filter((t) => t.ticketId)));
}

export function patchWalletTicket(ticketId: string, patch: Partial<IssuedTicket>) {
  if (typeof window === "undefined") return;
  const next = readWallet().map((ticket) =>
    ticket.ticketId === ticketId ? { ...ticket, ...patch } : ticket,
  );
  window.localStorage.setItem(WALLET_KEY, JSON.stringify(next));
  return next;
}

export function findWalletTicket(ticketId: string) {
  return readWallet().find((ticket) => ticket.ticketId === ticketId) ?? null;
}
