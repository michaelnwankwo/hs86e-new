"use client";

import { useEffect, useRef } from "react";
import { cn } from "@/lib/utils";

/**
 * Ambient gold-dust layer rendered on an ultra-lightweight HTML5 canvas.
 *
 * Particles (#F3E5AB / #D4AF37, alpha 0.3–0.7) drift radially OUTWARDS from
 * the header's volumetric light source with a gentle upward bias, mirroring
 * the gold rays of /images/header-burst.jpg. The header crops the TOP half of
 * the burst artwork (background-size 100% 200%, position top), so the light
 * source sits at bottom-center of the visible header box.
 *
 * Performance guards:
 *  - devicePixelRatio capped at 2
 *  - particle count scaled to the visible area (24–56)
 *  - rAF loop auto-pauses on hidden tabs (visibilitychange) and when the
 *    canvas leaves the viewport (IntersectionObserver)
 *  - transform-friendly drawing only; `will-change` hint on the element
 *  - prefers-reduced-motion → one static dust frame, no animation loop
 */

type Dust = { r: number; g: number; b: number };

/** Gold dust palette — #F3E5AB & #D4AF37 */
const DUST: Dust[] = [
  { r: 243, g: 229, b: 171 },
  { r: 212, g: 175, b: 55 },
];

type Particle = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  color: Dust;
  age: number;
  ttl: number;
  baseAlpha: number; // 0.3 – 0.7
};

export function GoldParticleField({ className }: { className?: string }) {
  const ref = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d", { alpha: true });
    if (!ctx) return;

    const reduced =
      typeof window.matchMedia === "function" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    let raf = 0;
    let alive = false;
    let width = 0;
    let height = 0;
    const particles: Particle[] = [];

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      width = canvas.clientWidth;
      height = canvas.clientHeight;
      canvas.width = Math.max(1, Math.round(width * dpr));
      canvas.height = Math.max(1, Math.round(height * dpr));
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    /** Light source — bottom-center of the cropped burst artwork. */
    const origin = () => ({ x: width * 0.5, y: height * 1.02 });

    const seed = (p: Particle, scatter: boolean): Particle => {
      const o = origin();
      const angle = Math.random() * Math.PI * 2;
      const dist = scatter
        ? Math.random() * Math.max(width, height) * 0.6
        : Math.random() * 24;
      p.x = o.x + Math.cos(angle) * dist;
      p.y = o.y + Math.sin(angle) * dist * 0.7;
      const speed = 0.12 + Math.random() * 0.3;
      // radial drift away from the light source + gentle upward bias
      p.vx = Math.cos(angle) * speed;
      p.vy = Math.sin(angle) * speed * 0.7 - 0.08;
      p.radius =
        Math.random() < 0.85 ? 0.6 + Math.random() * 1.1 : 1.8 + Math.random() * 1.6;
      p.color = DUST[Math.random() < 0.6 ? 0 : 1];
      p.age = scatter ? Math.floor(Math.random() * 200) : 0;
      p.ttl = 240 + Math.random() * 240;
      p.baseAlpha = 0.3 + Math.random() * 0.4;
      return p;
    };

    const targetCount = () =>
      Math.max(24, Math.min(56, Math.round((width * height) / 9000)));

    const sync = () => {
      const n = targetCount();
      while (particles.length < n) particles.push(seed({} as Particle, true));
      if (particles.length > n) particles.length = n;
    };

    const step = () => {
      ctx.clearRect(0, 0, width, height);
      for (const p of particles) {
        p.age += 1;
        if (p.age >= p.ttl) seed(p, false);
        p.x += p.vx;
        p.y += p.vy;
        const envelope = Math.sin(Math.PI * Math.min(1, p.age / p.ttl));
        const alpha = p.baseAlpha * envelope; // fade in → out, never above 0.7
        if (alpha <= 0.01) continue;
        ctx.beginPath();
        ctx.fillStyle = `rgba(${p.color.r},${p.color.g},${p.color.b},${alpha.toFixed(3)})`;
        ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
        ctx.fill();
      }
    };

    const loop = () => {
      step();
      raf = window.requestAnimationFrame(loop);
    };

    const start = () => {
      if (alive || reduced) return;
      alive = true;
      raf = window.requestAnimationFrame(loop);
    };
    const stop = () => {
      if (!alive) return;
      alive = false;
      window.cancelAnimationFrame(raf);
    };

    resize();
    sync();
    step(); // always paint one static dust frame (also the reduced-motion path)

    const onVis = () => (document.hidden ? stop() : start());
    const onResize = () => {
      resize();
      sync();
      if (reduced) step();
    };

    if (!reduced) {
      document.addEventListener("visibilitychange", onVis);
      window.addEventListener("resize", onResize);
      // pause the loop entirely when the header scrolls out of view
      const io = new IntersectionObserver(
        (entries) => {
          for (const entry of entries) {
            if (entry.isIntersecting) {
              if (!document.hidden) start();
            } else {
              stop();
            }
          }
        },
        { threshold: 0 },
      );
      io.observe(canvas);
      start();

      return () => {
        stop();
        io.disconnect();
        document.removeEventListener("visibilitychange", onVis);
        window.removeEventListener("resize", onResize);
      };
    }

    return () => {
      stop();
      window.removeEventListener("resize", onResize);
    };
  }, []);

  return (
    <canvas
      ref={ref}
      aria-hidden="true"
      className={cn("block", className)}
      style={{ willChange: "transform" }}
    />
  );
}
