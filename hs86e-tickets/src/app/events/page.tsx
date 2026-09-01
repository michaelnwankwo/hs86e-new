import { EventList } from "@/components/ticketing/EventList";
import { listEventsResult } from "@/services/catalog";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export const metadata = {
  title: "Events",
};

export default async function EventsIndexPage() {
  const catalog = await listEventsResult();

  return (
    <div className="px-4 py-6">
      <div className="mb-6">
        <h1 className="font-display text-3xl text-[#F8FAFC]">Events</h1>
        <p className="mt-2 text-sm text-[#DFB260]/80">Live from WordPress · updates as you publish</p>
      </div>
      <EventList initial={catalog} />
    </div>
  );
}
