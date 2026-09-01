import Link from "next/link";
import { ArrowRight, CalendarDays, MapPin } from "lucide-react";
import type { EventProduct } from "@/lib/types";
import { formatCardDate, formatMoney, formatVenue } from "@/lib/utils";
import { LOGO_PATH } from "@/lib/constants";

export function EventCard({ event }: { event: EventProduct }) {
  const from = event.variations.reduce(
    (min, v) => Math.min(min, v.price),
    event.variations[0]?.price ?? 0,
  );
  const venue = formatVenue(event.venue) || event.venue.name;
  const image = event.image || LOGO_PATH;

  return (
    <Link
      href={`/events/${event.slug}`}
      className="group block overflow-hidden rounded-xl border border-[#DFB260]/20 bg-[#0B0E14] transition duration-300 hover:border-[#F5D68D]/50 hover:shadow-[0_0_22px_rgba(223,178,96,0.14)] focus-visible:border-[#F5D68D]"
    >
      <div className="relative aspect-[16/8] w-full overflow-hidden bg-[#161B22]">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={image}
          alt=""
          className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.03]"
        />
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-[#0B0E14] via-transparent to-transparent" />
      </div>

      <div className="bg-[#161B22] px-4 py-4">
        <h3 className="font-display text-[1.3rem] font-semibold leading-tight tracking-tight text-[#F8FAFC]">
          {event.name}
        </h3>

        <ul className="mt-3 space-y-2">
          <li className="flex items-start gap-2 text-[13px] text-[#DFB260]">
            <CalendarDays className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#DFB260]" aria-hidden />
            <span>{formatCardDate(event.startsAt)}</span>
          </li>
          <li className="flex items-start gap-2 text-[13px] text-[#DFB260]/90">
            <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#DFB260]" aria-hidden />
            <span>{venue}</span>
          </li>
        </ul>

        <div className="mt-4 flex items-end justify-between gap-3 border-t border-[#DFB260]/20 pt-3">
          <div>
            <p className="text-[9px] font-semibold uppercase tracking-[0.22em] text-[#DFB260]/70">From</p>
            <p className="mt-0.5 font-display text-lg font-semibold text-[#F5D68D]">
              {formatMoney(from, event.currency)}
            </p>
          </div>
          <span className="inline-flex items-center gap-1 text-[13px] font-semibold text-[#DFB260] transition duration-300 group-hover:text-[#F5D68D] group-hover:drop-shadow-[0_0_10px_rgba(245,214,141,0.55)] group-focus-visible:text-[#F5D68D]">
            Buy tickets
            <ArrowRight className="h-3.5 w-3.5" aria-hidden />
          </span>
        </div>
      </div>
    </Link>
  );
}
