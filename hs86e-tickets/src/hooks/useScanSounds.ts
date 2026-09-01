"use client";

import { useCallback, useEffect, useRef } from "react";
import { SOUND_PATHS } from "@/lib/constants";

type Cue = "success" | "warn" | "fail";

export function useScanSounds() {
  const ctxRef = useRef<AudioContext | null>(null);
  const buffers = useRef<Partial<Record<Cue, AudioBuffer>>>({});
  const unlocked = useRef(false);

  const ensureContext = useCallback(async () => {
    if (!ctxRef.current) {
      const Ctx = window.AudioContext || (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Ctx) return null;
      ctxRef.current = new Ctx();
    }
    if (ctxRef.current.state === "suspended") {
      await ctxRef.current.resume();
    }
    return ctxRef.current;
  }, []);

  const load = useCallback(async () => {
    const ctx = await ensureContext();
    if (!ctx) return;
    await Promise.all(
      (Object.keys(SOUND_PATHS) as Cue[]).map(async (cue) => {
        if (buffers.current[cue]) return;
        try {
          const res = await fetch(SOUND_PATHS[cue]);
          const arr = await res.arrayBuffer();
          buffers.current[cue] = await ctx.decodeAudioData(arr.slice(0));
        } catch {
          buffers.current[cue] = undefined;
        }
      }),
    );
  }, [ensureContext]);

  useEffect(() => {
    return () => {
      ctxRef.current?.close().catch(() => undefined);
    };
  }, []);

  const unlock = useCallback(async () => {
    if (unlocked.current) return;
    unlocked.current = true;
    await load();
  }, [load]);

  const beepFallback = useCallback(async (cue: Cue) => {
    const ctx = await ensureContext();
    if (!ctx) return;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    const now = ctx.currentTime;
    osc.connect(gain);
    gain.connect(ctx.destination);
    if (cue === "success") {
      osc.frequency.setValueAtTime(880, now);
      osc.frequency.exponentialRampToValueAtTime(1320, now + 0.12);
    } else if (cue === "warn") {
      osc.frequency.setValueAtTime(494, now);
      osc.frequency.exponentialRampToValueAtTime(392, now + 0.18);
    } else {
      osc.type = "sawtooth";
      osc.frequency.setValueAtTime(140, now);
    }
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.18, now + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.28);
    osc.start(now);
    osc.stop(now + 0.3);
  }, [ensureContext]);

  const play = useCallback(
    async (cue: Cue) => {
      await unlock();
      const ctx = await ensureContext();
      const buffer = buffers.current[cue];
      if (!ctx || !buffer) {
        await beepFallback(cue);
        return;
      }
      const src = ctx.createBufferSource();
      const gain = ctx.createGain();
      src.buffer = buffer;
      gain.gain.value = 0.9;
      src.connect(gain);
      gain.connect(ctx.destination);
      src.start(0);
    },
    [beepFallback, ensureContext, unlock],
  );

  return { play, unlock };
}
