import type { Metadata } from "next";
import { Lock } from "lucide-react";

export const metadata: Metadata = {
  title: "Cultural Games",
  description:
    "Indigenous entertainment & interactive lounge — coming soon to HS86E.",
};

/**
 * Explicit cultural game products — title + one-line cultural subtitle.
 * Card art ships locally (/public/images/games) so the hub never renders
 * empty; the dark-gold gradient behind each image is the built-in fallback.
 */
type CulturalGame = {
  name: string;
  subtitle: string;
  image: string;
  alt: string;
};

const GAMES: CulturalGame[] = [
  {
    name: "Ayo Olopon",
    subtitle: "Traditional Yoruba Strategy & Pit Board Game",
    image: "/images/games/ayo-olopon.jpg",
    alt: "Carved Ayo Olopon mancala board with golden seeds",
  },
  {
    name: "Ludo Kingdom",
    subtitle: "Classic Nigerian Board & Dice Championship",
    image: "/images/games/ludo-kingdom.jpg",
    alt: "Gold-trimmed ludo board with dice on black leather",
  },
  {
    name: "Draft & Whooka",
    subtitle: "Street Checkers & Strategy League",
    image: "/images/games/draft-whooka.jpg",
    alt: "Black and gold checkers pieces on a dark draughts board",
  },
  {
    name: "Awa Reso",
    subtitle: "Indigenous Igbo Marble & Tactical Game",
    image: "/images/games/awa-reso.jpg",
    alt: "Polished golden marbles and tactical stones on dark slate",
  },
];

/**
 * Cultural Games teaser — full-bleed #000000 stage with the metallic
 * gold hierarchy. Games are locked (COMING SOON) until executive previews.
 */
export default function GamesPage() {
  return (
    <section className="games-fullbleed bg-black px-4 py-8 sm:px-6 sm:py-10">
      <header className="mb-7 text-center sm:mb-9">
        <h1 className="bg-gradient-to-b from-[#F5D68D] via-[#D4AF37] to-[#C5A059] bg-clip-text font-display text-3xl tracking-[0.1em] text-transparent sm:text-4xl">
          CULTURAL GAMES
        </h1>
        <p className="mx-auto mt-3 max-w-md text-sm text-[#C5A059]/85">
          Indigenous entertainment &amp; interactive lounge — coming soon to
          HS86E.
        </p>
        <div
          aria-hidden="true"
          className="mx-auto mt-5 h-px w-24 bg-gradient-to-r from-transparent via-[#D4AF37]/70 to-transparent"
        />
      </header>

      <div className="grid gap-4 sm:grid-cols-2 sm:gap-5">
        {GAMES.map((game) => (
          <article
            key={game.name}
            className="group relative aspect-video overflow-hidden rounded-xl border border-[#C5A059]/35 bg-gradient-to-br from-neutral-900 via-yellow-950/20 to-black transition-all duration-300 hover:border-[#D4AF37]/50 hover:shadow-[0_0_0_1px_rgba(212,175,55,0.35),0_0_42px_rgba(212,175,55,0.22)]"
          >
            {/* Card art — local royalty-free asset; gradient behind = fallback */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={game.image}
              alt={game.alt}
              loading="lazy"
              className="absolute inset-0 h-full w-full object-cover opacity-45 transition-all duration-500 group-hover:scale-[1.04] group-hover:opacity-60"
            />
            {/* Legibility vignette so type stays crisp over the art */}
            <div
              aria-hidden="true"
              className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/30 to-black/45"
            />

            {/* Content — top row: title/subtitle left, frosted badge right */}
            <div className="relative flex h-full flex-col justify-between p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h3 className="text-lg font-bold uppercase tracking-wider text-[#D4AF37]">
                    {game.name}
                  </h3>
                  <p className="mt-1 text-xs text-neutral-400">
                    {game.subtitle}
                  </p>
                </div>
                <span className="shrink-0 rounded-full border border-[#D4AF37]/30 bg-[#D4AF37]/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-widest text-[#D4AF37] backdrop-blur-md">
                  COMING SOON
                </span>
              </div>

              {/* Bottom CTA — locked, dimmed, executive-preview hint on hover */}
              <div className="flex items-end justify-between gap-3">
                <button
                  type="button"
                  disabled
                  aria-disabled="true"
                  title="Releasing during executive previews"
                  className="inline-flex cursor-not-allowed items-center gap-2 rounded-md border border-[#D4AF37]/40 bg-black/50 px-4 py-2 text-[11px] font-bold uppercase tracking-[0.18em] text-[#D4AF37]/80 backdrop-blur-md"
                >
                  <Lock className="h-3.5 w-3.5" aria-hidden="true" />
                  PLAY NOW
                </button>
                <p className="text-right text-[10px] leading-snug text-neutral-500 opacity-0 transition-opacity duration-300 group-hover:opacity-100 group-focus-within:opacity-100">
                  Unlocking during executive previews
                </p>
              </div>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
