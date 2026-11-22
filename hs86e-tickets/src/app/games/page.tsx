import type { Metadata } from "next";
import { Lock } from "lucide-react";

export const metadata: Metadata = {
  title: "Cultural Games",
  description:
    "Global Strategic Mind Sports & Tournament Arenas - Coming to HS86E.",
};

/**
 * RSG-ENG-UI-007 — Cultural Games dual-tier taxonomy.
 * Card art ships locally in /public/images/games (uploaded artwork for
 * Mancala/Ludo/Draughts + an original editorial Whot! plate) so the hub
 * never renders empty; the dark gradient behind each image is the fallback.
 * Every card is locked (COMING SOON / JOIN WAITLIST) until executive previews —
 * no matchmaking sockets are wired yet.
 */
type MindSport = {
  kicker: string;
  title: string;
  subhead: string;
  copy: string;
  image: string;
  alt: string;
};

const GAMES: MindSport[] = [
  {
    kicker: "NCHỌ / AYO OLOPON",
    title: "MANCALA",
    subhead: "Count-and-Capture Board",
    copy: "Out-calculate opponents in the world's most enduring mathematical pit-and-pebble mind sport championship.",
    image: "/images/games/mancala.jpg",
    alt: "Carved wooden mancala board filled with emerald and gold stones on dark leather",
  },
  {
    kicker: "CROSS & CIRCLE ARENA",
    title: "LUDO CHAMPIONSHIP",
    subhead: "Classic Dice Strategy",
    copy: "High-stakes token navigation, tactical blockades, and precision dice rolls to rule the home matrix.",
    image: "/images/games/ludo.jpg",
    alt: "Classic cross-and-circle ludo board with red, green and yellow tokens and dice",
  },
  {
    kicker: "DAMA 10×10 / 8×8",
    title: "DRAUGHTS & CHECKERS",
    subhead: "Diagonal Strategy League",
    copy: "High-speed diagonal captures and king-tier dominance across international 10×10 and street 8×8 boards.",
    image: "/images/games/checkers.jpg",
    alt: "Black and gold checkers pieces mid-game on a dark draughts board beside a whisky glass",
  },
  {
    kicker: "THE HERITAGE CARD CLASH",
    title: "WHOT! NATIONAL LEAGUE",
    subhead: "Strategic Shape & Number Clash",
    copy: "Fast-paced card elimination mastering Hold On, Pick Two, and General Market plays.",
    image: "/images/games/whot.jpg",
    alt: "Authentic Nigerian WHOT cards — circles, triangles, crosses, squares, stars and the WHOT card — spread on a mahogany table",
  },
];

export default function GamesPage() {
  return (
    <section className="games-fullbleed bg-[#0b0b0b] px-4 py-8 sm:px-6 sm:py-10 lg:px-8">
      <header className="mb-7 text-center sm:mb-9">
        <h1 className="bg-gradient-to-b from-[#F5D68D] via-[#D4AF37] to-[#C5A059] bg-clip-text font-display text-3xl tracking-[0.1em] text-transparent sm:text-4xl">
          CULTURAL GAMES
        </h1>
        <p className="mx-auto mt-3 max-w-md text-sm text-[#C5A059]/90">
          Global Strategic Mind Sports &amp; Tournament Arenas - Coming to
          HS86E.
        </p>
        <div
          aria-hidden="true"
          className="mx-auto mt-5 h-px w-24 bg-gradient-to-r from-transparent via-[#D4AF37]/70 to-transparent"
        />
      </header>

      <div className="mx-auto grid max-w-6xl gap-4 sm:grid-cols-2 sm:gap-5">
        {GAMES.map((game) => (
          <article
            key={game.title}
            className="group relative aspect-video overflow-hidden rounded-xl border border-[#2a2a2a] bg-[#0b0b0b] transition-all duration-300 hover:border-[#D4AF37]/45 hover:shadow-[0_0_0_1px_rgba(212,175,55,0.30),0_0_42px_rgba(212,175,55,0.18)]"
          >
            {/* Card art — locally shipped; gradient behind = fallback */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={game.image}
              alt={game.alt}
              loading="lazy"
              className="absolute inset-0 h-full w-full object-cover opacity-60 transition-all duration-500 group-hover:scale-[1.04] group-hover:opacity-75"
            />
            {/* Gentle legibility vignette — art stays visible */}
            <div
              aria-hidden="true"
              className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/25 to-black/40"
            />

            {/* Content — 16px padding both axes, top meta row + bottom CTA row */}
            <div className="relative flex h-full flex-col justify-between p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-[9px] font-semibold uppercase tracking-[0.22em] text-[#C5A059]/90">
                    {game.kicker}
                  </p>
                  <h3 className="mt-1 text-base font-bold uppercase leading-tight tracking-wider text-[#D4AF37] sm:text-lg">
                    {game.title}
                  </h3>
                  <p className="mt-0.5 text-[11px] text-neutral-300">
                    {game.subhead}
                  </p>
                </div>
                <span className="shrink-0 rounded-full border border-[#D4AF37]/35 bg-[#0b0b0b]/70 px-2.5 py-1 text-[9px] font-semibold uppercase tracking-[0.2em] text-[#D4AF37] backdrop-blur-md sm:text-[10px]">
                  COMING SOON
                </span>
              </div>

              <div className="flex items-end justify-between gap-3">
                <p className="max-w-[62%] text-[10px] leading-snug text-neutral-400 sm:text-[11px]">
                  {game.copy}
                </p>
                <button
                  type="button"
                  disabled
                  aria-disabled="true"
                  title="Join the waitlist during executive previews"
                  className="inline-flex shrink-0 cursor-not-allowed items-center gap-2 rounded-md border border-[#D4AF37]/45 bg-black/60 px-3 py-2 text-[10px] font-bold uppercase tracking-[0.18em] text-[#D4AF37] backdrop-blur-md sm:px-4 sm:text-[11px]"
                >
                  <Lock className="h-3.5 w-3.5" aria-hidden="true" />
                  JOIN WAITLIST
                </button>
              </div>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
