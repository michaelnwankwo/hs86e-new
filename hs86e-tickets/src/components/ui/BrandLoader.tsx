"use client";

import { LOGO_PATH } from "@/lib/constants";

export function BrandLoader({ label = "Loading" }: { label?: string }) {
  return (
    <div className="flex min-h-[40vh] flex-col items-center justify-center px-6 py-12">
      <div className="relative grid place-items-center">
        <span className="absolute h-28 w-28 animate-pulse rounded-full bg-[#DFB260]/15 blur-2xl" />
        <span className="absolute h-20 w-20 animate-ping rounded-full border border-[#DFB260]/25" />
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={LOGO_PATH}
          alt=""
          className="relative z-10 h-16 w-auto animate-pulse object-contain drop-shadow-[0_0_24px_rgba(223,178,96,0.35)]"
        />
      </div>
      <p className="mt-6 text-[10px] font-semibold uppercase tracking-[0.28em] text-[#DFB260]">{label}</p>
    </div>
  );
}

export function EventListSkeleton() {
  return (
    <div className="space-y-4" aria-hidden>
      {[0, 1].map((key) => (
        <div
          key={key}
          className="overflow-hidden rounded-xl border border-[#DFB260]/15 bg-[#161B22]"
        >
          <div className="shimmer aspect-[16/8] w-full bg-[#0B0E14]" />
          <div className="space-y-3 px-4 py-4">
            <div className="shimmer h-5 w-2/3 rounded bg-[#0B0E14]" />
            <div className="shimmer h-3 w-1/2 rounded bg-[#0B0E14]" />
            <div className="shimmer h-3 w-3/5 rounded bg-[#0B0E14]" />
            <div className="mt-2 flex justify-between border-t border-[#DFB260]/10 pt-3">
              <div className="shimmer h-8 w-20 rounded bg-[#0B0E14]" />
              <div className="shimmer h-4 w-24 rounded bg-[#0B0E14]" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

export function WalletSkeleton() {
  return (
    <div className="space-y-3" aria-hidden>
      {[0, 1, 2].map((key) => (
        <div
          key={key}
          className="flex items-center gap-3 rounded-2xl border border-[#DFB260]/15 bg-[#161B22] px-4 py-3.5"
        >
          <div className="min-w-0 flex-1 space-y-2">
            <div className="shimmer h-4 w-2/3 rounded bg-[#0B0E14]" />
            <div className="shimmer h-3 w-1/3 rounded bg-[#0B0E14]" />
          </div>
          <div className="shimmer h-6 w-14 rounded-full bg-[#0B0E14]" />
        </div>
      ))}
    </div>
  );
}
