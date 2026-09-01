"use client";

import { useEffect, useMemo, useState } from "react";
import type { IssuedTicket } from "@/lib/types";
import { TicketCard } from "./TicketCard";

export function TicketWallet({
  tickets,
  focusTicketId,
  onTicketChange,
}: {
  tickets: IssuedTicket[];
  focusTicketId?: string;
  onTicketChange?: (ticket: IssuedTicket) => void;
}) {
  const ordered = useMemo(() => {
    if (!focusTicketId) return tickets;
    const focused = tickets.filter((row) => row.ticketId === focusTicketId);
    const rest = tickets.filter((row) => row.ticketId !== focusTicketId);
    return [...focused, ...rest];
  }, [tickets, focusTicketId]);

  const [openId, setOpenId] = useState<string | null>(focusTicketId || null);

  useEffect(() => {
    if (focusTicketId) setOpenId(focusTicketId);
  }, [focusTicketId]);

  return (
    <div className="space-y-3">
      {ordered.map((ticket, index) => (
        <TicketCard
          key={ticket.ticketId}
          ticket={ticket}
          index={ticket.passIndex || index + 1}
          total={ticket.passTotal || tickets.length}
          open={openId === ticket.ticketId}
          highlight={focusTicketId === ticket.ticketId}
          onToggle={() =>
            setOpenId((current) => (current === ticket.ticketId ? null : ticket.ticketId))
          }
          onTransferred={onTicketChange}
        />
      ))}
    </div>
  );
}
