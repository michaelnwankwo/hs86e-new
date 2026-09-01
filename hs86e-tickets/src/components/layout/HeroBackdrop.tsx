import type { ReactNode } from "react";

export function HeroBackdrop({ children }: { children: ReactNode }) {
  return (
    <section className="relative overflow-hidden px-4 pb-8 pt-6">
      <div className="pointer-events-none absolute inset-0 bg-hero-radial" />
      <div className="pointer-events-none absolute left-1/2 top-8 h-64 w-64 -translate-x-1/2 rounded-full bg-gold/10 blur-3xl" />
      <div className="relative z-10">{children}</div>
    </section>
  );
}
