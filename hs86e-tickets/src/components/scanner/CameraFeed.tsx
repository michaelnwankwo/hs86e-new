"use client";

export function CameraFeed({ elementId, isProcessingScan = false }: { elementId: string; isProcessingScan?: boolean }) {
  return (
    <div className="relative overflow-hidden rounded-3xl border border-gold/25 bg-black">
      <div id={elementId} className="min-h-[320px] w-full overflow-hidden [&_video]:h-full [&_video]:w-full [&_video]:object-cover" />
      <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
        <div className="h-[250px] w-[250px] rounded-2xl border-2 border-gold-champagne/80 shadow-[0_0_0_999px_rgba(11,14,20,0.35)]" />
      </div>
      {isProcessingScan ? (
        <div
          aria-live="polite"
          className="pointer-events-none absolute inset-x-3 bottom-4 mx-auto w-fit max-w-[calc(100%-1.5rem)] rounded-full border border-emerald-300/30 bg-emerald-950/90 px-4 py-2 text-center text-xs font-semibold text-emerald-100 shadow-lg"
        >
          Verifying ticket · please wait
        </div>
      ) : null}
    </div>
  );
}
