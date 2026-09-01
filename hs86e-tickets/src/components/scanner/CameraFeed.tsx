"use client";

export function CameraFeed({ elementId }: { elementId: string }) {
  return (
    <div className="relative overflow-hidden rounded-3xl border border-gold/25 bg-black">
      <div id={elementId} className="min-h-[320px] w-full overflow-hidden [&_video]:h-full [&_video]:w-full [&_video]:object-cover" />
      <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
        <div className="h-[250px] w-[250px] rounded-2xl border-2 border-gold-champagne/80 shadow-[0_0_0_999px_rgba(11,14,20,0.35)]" />
      </div>
    </div>
  );
}
