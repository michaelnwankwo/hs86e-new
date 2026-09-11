"use client";

import type { IssuedTicket } from "@/lib/types";
import { WALLET_KEY, WALLET_KEY_LEGACY } from "@/lib/constants";
import { safeJson } from "@/lib/utils";

/**
 * localStorage can THROW (Safari private browsing, storage-disabled browsers,
 * sandboxed iframes). Every access is guarded so the wallet UI can never
 * crash or leave the loading state mounted on a storage exception.
 */
function storageGet(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function storageSet(key: string, value: string): void {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // non-fatal — wallet simply won't persist this write
  }
}

function storageRemove(key: string): void {
  try {
    window.localStorage.removeItem(key);
  } catch {
    // non-fatal
  }
}

function readKey(key: string): IssuedTicket[] {
  const parsed = safeJson<unknown>(storageGet(key), []);
  if (!Array.isArray(parsed)) return [];
  return (parsed as unknown[]).filter(
    (row): row is IssuedTicket =>
      Boolean(row) &&
      typeof row === "object" &&
      Boolean((row as IssuedTicket).ticketId),
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
  storageSet(WALLET_KEY, JSON.stringify(merged));
  storageRemove(WALLET_KEY_LEGACY);
  return merged;
}

export function writeWallet(tickets: IssuedTicket[]) {
  if (typeof window === "undefined") return;
  const current = readWallet();
  const map = new Map(current.map((ticket) => [ticket.ticketId, ticket]));
  for (const ticket of tickets) {
    if (ticket.ticketId) map.set(ticket.ticketId, ticket);
  }
  storageSet(WALLET_KEY, JSON.stringify([...map.values()]));
}

export function replaceWallet(tickets: IssuedTicket[]) {
  if (typeof window === "undefined") return;
  storageSet(WALLET_KEY, JSON.stringify(tickets.filter((t) => t.ticketId)));
}

export function patchWalletTicket(ticketId: string, patch: Partial<IssuedTicket>) {
  if (typeof window === "undefined") return;
  const next = readWallet().map((ticket) =>
    ticket.ticketId === ticketId ? { ...ticket, ...patch } : ticket,
  );
  storageSet(WALLET_KEY, JSON.stringify(next));
  return next;
}

export function findWalletTicket(ticketId: string) {
  return readWallet().find((ticket) => ticket.ticketId === ticketId) ?? null;
}
