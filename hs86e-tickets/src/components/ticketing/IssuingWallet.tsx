"use client";

import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { TICKET_POLL_ATTEMPTS, TICKET_POLL_MS } from "@/lib/constants";
import type { IssuedTicket } from "@/lib/types";
import { StatusBanner } from "@/components/ui/StatusBanner";
import { TicketWallet } from "./TicketWallet";
import { patchWalletTicket, readWallet, writeWallet } from "@/lib/wallet-store";
import { Button } from "@/components/ui/Button";
import { LoadingOverlay } from "@/components/ui/LoadingOverlay";

async function fetchTickets(order: string, key?: string, email?: string, ticket?: string) {
  const params = new URLSearchParams();
  if (ticket) params.set("ticketId", ticket);
  if (order) params.set("order", order);
  if (key) params.set("key", key);
  if (email) params.set("email", email);
  const res = await fetch(`/api/tickets?${params.toString()}`, { cache: "no-store" });
  const data = (await res.json()) as {
    tickets?: IssuedTicket[];
    issuing?: boolean;
    error?: string;
    status?: string;
  };
  if (!res.ok && !data.tickets?.length) throw new Error(data.error || "Unable to load tickets");
  return data;
}

export function IssuingWallet({
  order,
  orderKey,
  email,
  ticket,
}: {
  order: string;
  orderKey?: string;
  email?: string;
  ticket?: string;
}) {
  const enabled = Boolean(ticket || order || email || orderKey);
  const [local, setLocal] = useState<IssuedTicket[]>([]);
  const [hydrated, setHydrated] = useState(false);

  const query = useQuery({
    queryKey: ["tickets", order, orderKey, email, ticket],
    queryFn: () => fetchTickets(order, orderKey, email, ticket),
    enabled,
    staleTime: 0,
    refetchOnWindowFocus: true,
    refetchInterval: (q) => {
      const data = q.state.data;
      if (data?.tickets && data.tickets.length > 0) return false;
      if ((q.state.dataUpdateCount ?? 0) >= TICKET_POLL_ATTEMPTS) return false;
      return TICKET_POLL_MS;
    },
  });

  useEffect(() => {
    const stored = readWallet().filter((row) => {
      if (ticket) return row.ticketId === ticket;
      if (order && row.orderId === Number(order)) return true;
      if (email) {
        const token = email.toLowerCase();
        return (
          row.attendeeEmail.toLowerCase() === token ||
          (row.assignedEmail || "").toLowerCase() === token ||
          (row.purchaserEmail || "").toLowerCase() === token
        );
      }
      return !enabled;
    });
    setLocal(stored);
    setHydrated(true);
  }, [enabled, order, email, ticket]);

  const remote = useMemo(
    () => query.data?.tickets?.filter((row) => Boolean(row.ticketId)) ?? [],
    [query.data?.tickets],
  );

  useEffect(() => {
    if (remote.length === 0) return;
    writeWallet(remote);
    setLocal(remote);
  }, [remote]);

  const tickets = remote.length > 0 ? remote : local;
  const overlay =
    !hydrated ||
    (enabled && tickets.length === 0 && (query.isLoading || query.isFetching) && !query.isError);

  function handleTicketChange(updated: IssuedTicket) {
    patchWalletTicket(updated.ticketId, updated);
    setLocal((current) =>
      current.map((row) => (row.ticketId === updated.ticketId ? { ...row, ...updated } : row)),
    );
  }

  const body = (() => {
    if (!enabled) {
      if (tickets.length === 0) return null;
      return (
        <TicketWallet
          tickets={tickets}
          focusTicketId={ticket}
          onTicketChange={handleTicketChange}
        />
      );
    }

    if (query.isError && tickets.length === 0) {
      return (
        <div className="space-y-3">
          <StatusBanner tone="danger">{(query.error as Error).message}</StatusBanner>
          <Button variant="ghost" block onClick={() => void query.refetch()}>
            Retry
          </Button>
        </div>
      );
    }

    if (tickets.length === 0 && !overlay) {
      return (
        <div className="space-y-3">
          <StatusBanner tone="warn">
            No pass matched. Use ticket ID, order ID, or the checkout email — any one is enough.
          </StatusBanner>
          <Button variant="ghost" block onClick={() => void query.refetch()}>
            Retry
          </Button>
        </div>
      );
    }

    if (tickets.length === 0) return null;
    const focused = ticket ? tickets.find((row) => row.ticketId === ticket) : undefined;
    return (
      <div className="space-y-3">
        {focused && focused.holder !== false && focused.qrPayload ? (
          <StatusBanner tone="success">
            This is the live pass for {focused.ticketId}. The QR below is the current signed code.
          </StatusBanner>
        ) : null}
        <TicketWallet tickets={tickets} focusTicketId={ticket} onTicketChange={handleTicketChange} />
      </div>
    );
  })();

  return (
    <>
      {body}
      <LoadingOverlay isLoading={overlay} />
    </>
  );
}
