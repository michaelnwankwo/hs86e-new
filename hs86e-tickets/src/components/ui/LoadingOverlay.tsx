"use client";

import { useEffect } from "react";

const DELAYS = ["0s", "0.1s", "0.2s", "0.3s", "0.4s", "0.5s"];

export function LoadingOverlay({ isLoading }: { isLoading: boolean }) {
  useEffect(() => {
    if (!isLoading) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [isLoading]);

  if (!isLoading) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-[#0B0E14]/80 backdrop-blur-md"
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      <div className="relative flex flex-col items-center">
        <span className="pointer-events-none absolute h-32 w-32 rounded-full bg-[#DFB260]/15 blur-xl" />
        <div className="relative flex h-[60px] items-end gap-2">
          {DELAYS.map((delay) => (
            <span
              key={delay}
              className="eq-bar w-1.5 rounded-full bg-[#DFB260]"
              style={{ animationDelay: delay }}
            />
          ))}
        </div>
        <p
          className="relative mt-6 text-[11px] font-semibold uppercase text-[#F8FAFC]/80"
          style={{ letterSpacing: "0.25em" }}
        >
          L O A D I N G
        </p>
      </div>
    </div>
  );
}
