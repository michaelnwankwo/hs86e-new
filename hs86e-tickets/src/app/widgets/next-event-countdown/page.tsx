"use client";

import { useEffect, useState } from "react";

interface CountdownEvent {
  id: string;
  name: string;
  venue: string;
  doorsAt: string;
  startsAt: string;
}

interface CountdownData {
  tag: string;
  event: CountdownEvent | null;
  generatedAt: string;
}

function segments(ms: number) {
  const total = Math.max(0, Math.floor(ms / 1000));
  const d = Math.floor(total / 86400);
  const h = Math.floor((total % 86400) / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return { d, h, m, s };
}

function pad(n: number) {
  return String(n).padStart(2, "0");
}

export default function NextEventCountdownWidget() {
  const [data, setData] = useState<CountdownData | null>(null);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    let cancelled = false;
    fetch("/api/widgets/next-event-countdown", { cache: "no-store" })
      .then((res) => res.json())
      .then((json: CountdownData) => {
        if (!cancelled) setData(json);
      })
      .catch(() => {
        /* offline — service worker cache will serve on retry */
      });
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, []);

  const event = data?.event ?? null;
  const target = event ? Date.parse(event.doorsAt || event.startsAt) : NaN;
  const seg = Number.isFinite(target) ? segments(target - now) : null;
  const live = event && Number.isFinite(target) && target <= now;

  return (
    <main
      style={{
        minHeight: "100dvh",
        background: "#0B0E14",
        color: "#F8FAFC",
        fontFamily: "Georgia, 'Times New Roman', serif",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: 24,
        textAlign: "center",
      }}
    >
      <p style={{ color: "#DFB260", fontSize: 11, letterSpacing: "0.22em", textTransform: "uppercase", margin: 0 }}>
        Hot Since 86 Entertainment
      </p>
      {event ? (
        <>
          <h1 style={{ fontSize: 24, fontWeight: 600, margin: "12px 0 4px" }}>{event.name}</h1>
          <p style={{ color: "#F5D68D", fontSize: 14, margin: "0 0 20px" }}>{event.venue}</p>
          {live ? (
            <p style={{ color: "#DFB260", fontSize: 18, margin: 0 }}>Doors are open</p>
          ) : seg ? (
            <div style={{ display: "flex", gap: 12 }}>
              {[
                { label: "DAYS", value: seg.d },
                { label: "HRS", value: seg.h },
                { label: "MIN", value: seg.m },
                { label: "SEC", value: seg.s },
              ].map((cell) => (
                <div
                  key={cell.label}
                  style={{
                    background: "#161B22",
                    border: "1px solid rgba(223,178,96,0.25)",
                    borderRadius: 12,
                    padding: "12px 14px",
                    minWidth: 64,
                  }}
                >
                  <div style={{ fontSize: 30, fontWeight: 700, color: "#F5D68D" }}>{pad(cell.value)}</div>
                  <div style={{ fontSize: 9, letterSpacing: "0.18em", color: "#DFB260", marginTop: 4 }}>{cell.label}</div>
                </div>
              ))}
            </div>
          ) : null}
        </>
      ) : (
        <p style={{ color: "#94A3B8", fontSize: 14 }}>No upcoming event found.</p>
      )}
    </main>
  );
}
