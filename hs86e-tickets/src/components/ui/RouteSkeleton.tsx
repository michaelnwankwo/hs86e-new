/**
 * Shimmer skeletons shown as Next.js segment fallbacks during route transitions.
 * Structural placeholders — never spinners, never full-screen blockers.
 * The gold GoldTopLoader in the AppHeader is the progress indicator itself.
 */
import { LOGO_PATH } from "@/lib/constants";

function Line({ className }: { className: string }) {
  return <div className={`shimmer h-3 rounded bg-[#161B22] ${className}`} />;
}

function Card({ className }: { className?: string }) {
  return (
    <div className={`overflow-hidden rounded-2xl border border-[#D4AF37]/12 bg-[#161B22]/60 ${className ?? ""}`}>
      <div className="shimmer aspect-[16/8] w-full bg-[#0B0E14]" />
      <div className="space-y-3 p-4">
        <Line className="w-2/3" />
        <Line className="w-1/2" />
        <Line className="w-3/5" />
      </div>
    </div>
  );
}

export function RouteSkeleton({ variant = "root" }: { variant?: "root" | "list" | "tickets" | "checkout" | "scan" }) {
  if (variant === "scan") {
    return (
      <main role="status" aria-busy="true" aria-label="Loading scanner"
        className="mx-auto flex min-h-[72dvh] w-full max-w-md flex-col items-center justify-center gap-6 px-6 py-12">
        <div className="shimmer h-64 w-64 rounded-2xl border border-[#D4AF37]/20 bg-[#0B0E14]" />
        <Line className="w-40" />
        <Line className="w-24" />
      </main>
    );
  }

  if (variant === "checkout") {
    return (
      <main role="status" aria-busy="true" aria-label="Loading checkout" className="mx-auto w-full max-w-lg space-y-5 px-4 py-8 sm:px-6">
        <div className="shimmer h-5 w-32 rounded bg-[#161B22]" />
        <div className="shimmer h-4 w-56 rounded bg-[#161B22]" />
        <div className="rounded-2xl border border-[#D4AF37]/12 bg-[#161B22]/60 p-5">
          <div className="flex items-center gap-4">
            <div className="shimmer h-20 w-20 rounded-xl bg-[#0B0E14]" />
            <div className="flex-1 space-y-3">
              <Line className="w-4/5" />
              <Line className="w-1/2" />
            </div>
          </div>
          <div className="mt-5 space-y-3 border-t border-[#D4AF37]/10 pt-4">
            <Line className="w-full" />
            <Line className="w-3/4" />
          </div>
        </div>
        <div className="shimmer h-14 w-full rounded-xl bg-[#D4AF37]/15" />
      </main>
    );
  }

  if (variant === "tickets") {
    return (
      <main role="status" aria-busy="true" aria-label="Loading your tickets" className="mx-auto w-full max-w-2xl space-y-4 px-4 py-8 sm:px-6">
        <Line className="h-5 w-40" />
        <Line className="h-4 w-64" />
        {[0, 1, 2].map((i) => (
          <div key={i} className="flex items-center gap-4 rounded-2xl border border-[#D4AF37]/12 bg-[#161B22]/60 p-4">
            <div className="shimmer h-16 w-12 rounded-md bg-[#0B0E14]" />
            <div className="flex-1 space-y-3">
              <Line className="w-2/3" />
              <Line className="w-1/2" />
            </div>
            <div className="shimmer h-10 w-10 rounded-lg bg-[#0B0E14]" />
          </div>
        ))}
      </main>
    );
  }

  // "list" (events) — card grid placeholders
  if (variant === "list") {
    return (
      <main role="status" aria-busy="true" aria-label="Loading events" className="mx-auto w-full max-w-3xl space-y-5 px-4 py-8">
        <Line className="h-6 w-44" />
        <Line className="h-4 w-72" />
        <Card className="lg:hidden" />
        <Card />
        <Card />
      </main>
    );
  }

  // "root" — hero-ish placeholder + cards (covers /wallet, /create, /dashboard, /games transitions)
  return (
    <main role="status" aria-busy="true" aria-label="Loading page" className="mx-auto w-full max-w-3xl space-y-6 px-4 py-8">
      <div className="rounded-3xl border border-[#D4AF37]/12 bg-[#161B22]/60 p-6">
        <div className="flex items-center gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={LOGO_PATH} alt="" className="h-10 w-10 object-contain opacity-60" />
          <Line className="h-4 w-28" />
        </div>
        <div className="shimmer mt-5 h-12 w-2/3 rounded-lg bg-[#0B0E14]" />
        <Line className="mt-4 w-3/4" />
        <Line className="mt-2 w-1/2" />
        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          <div className="shimmer h-12 rounded-xl bg-[#D4AF37]/10" />
          <div className="shimmer h-12 rounded-xl bg-[#0B0E14]" />
        </div>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Card />
        <Card />
      </div>
    </main>
  );
}
