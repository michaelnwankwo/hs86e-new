import { notFound } from "next/navigation";
import { CalendarDays, MapPin } from "lucide-react";
import { BuyTicketForm } from "@/components/ticketing/BuyTicketForm";
import { ProductGallery } from "@/components/ticketing/ProductGallery";
import { getEvent } from "@/services/catalog";
import { formatWhen } from "@/lib/utils";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const event = await getEvent(slug).catch(() => null);
  return { title: event?.name ?? "Event" };
}

export default async function EventPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  // getEvent() never rejects; on any failure we fall through to the branded
  // not-found page instead of a server-side exception.
  const event = await getEvent(slug).catch(() => null);
  if (!event) notFound();

  const venueLine = [event.venue.name, event.venue.address, event.venue.city].filter(Boolean).join(" · ");

  return (
    <article className="px-4 pb-8 pt-4">
      <div className="relative overflow-hidden rounded-3xl border border-gold/20 bg-surface-raised">
        <div className="pointer-events-none absolute inset-0 bg-hero-radial" />
        <div className="relative flex flex-col items-center px-4 py-8">
          <h1 className="text-center font-display text-4xl text-ink">{event.name}</h1>
          {event.shortDescription ? (
            <p className="mt-3 max-w-md text-center text-sm text-ink-muted">{event.shortDescription}</p>
          ) : null}
        </div>
      </div>

      <dl className="mt-4 grid gap-2 text-sm text-ink-muted">
        {event.startsAt ? (
          <div className="flex items-center gap-2">
            <CalendarDays className="h-4 w-4 text-gold" />
            <span>{formatWhen(event.startsAt)}</span>
          </div>
        ) : null}
        {venueLine ? (
          <div className="flex items-center gap-2">
            <MapPin className="h-4 w-4 text-gold" />
            <span>{venueLine}</span>
          </div>
        ) : null}
      </dl>

      <ProductGallery images={event.gallery ?? []} />

      <div className="mt-6">
        <BuyTicketForm event={event} />
      </div>
    </article>
  );
}
