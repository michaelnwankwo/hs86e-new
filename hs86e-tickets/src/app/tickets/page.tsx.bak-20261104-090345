import { FindTicketsForm } from "@/components/ticketing/FindTicketsForm";
import { IssuingWallet } from "@/components/ticketing/IssuingWallet";

export const dynamic = "force-dynamic";

export default async function TicketsPage({
  searchParams,
}: {
  searchParams: Promise<{
    order?: string;
    email?: string;
    key?: string;
    ticket?: string;
    ticketId?: string;
  }>;
}) {
  const q = await searchParams;
  const ticket = q.ticketId || q.ticket;
  return (
    <div className="px-4 py-6">
      <div className="mb-6">
        <h1 className="font-display text-3xl text-[#F8FAFC]">Ticket wallet</h1>
        <p className="mt-2 text-sm text-[#DFB260]/80">
          Look up with ticket ID, order ID, or email — one field is enough. Share or transfer
          individual passes from a bulk order.
        </p>
      </div>

      <FindTicketsForm initialOrder={q.order} initialEmail={q.email} initialTicket={ticket} />

      <p className="mb-6 mt-2 text-center text-xs text-[#DFB260]/60">
        Passes bought on this phone stay collapsed here. Tap a row to show its QR. Copy the Ticket
        ID or share a direct pass link with a guest.
      </p>

      <IssuingWallet
        order={q.order ?? ""}
        email={q.email}
        orderKey={q.key}
        ticket={ticket}
      />
    </div>
  );
}
