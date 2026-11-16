"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  AlignLeft, ArrowLeft, ArrowRight, CalendarDays, Check, Loader2, MapPin, PartyPopper,
  Plus, Tag, Ticket, Trash2, Wallet,
} from "lucide-react";
import { formatMoney } from "@/lib/utils";

type TicketTier = { id: string; name: string; price: string; quantity: string };
type Submission = {
  id: string; title: string; category: string | null; status: string;
  fee_minor: number; fee_ref: string | null; starts_at: string; created_at: string;
};
type Config = {
  walletEnabled: boolean; frozen?: boolean; feeMinor: number; currency: string; submissions: Submission[];
};

const CATEGORIES = [
  "Afrobeats & Live Music", "Concerts & Festivals", "Comedy", "Food & Drinks", "Brunch & Brunette",
  "Networking & Professional", "Wellness & Fitness", "Cinema & Screenings", "Sports & Games",
  "Business & Masterclass", "Nightlife", "Family & Kids", "Other",
] as const;

const STEP_TITLES = ["Basic info", "Details", "Tickets & pricing", "Review & pay"] as const;
const DRAFT_KEY = "hs86e:create-event:draft:v1";

const newTier = (): TicketTier => ({ id: Math.random().toString(36).slice(2), name: "", price: "", quantity: "" });

const submissionPill = (status: string): { label: string; cls: string } => {
  switch (status) {
    case "pending_review": return { label: "Pending review", cls: "border-amber-bright/50 text-amber-bright" };
    case "approved": return { label: "Approved", cls: "border-gold/40 text-gold" };
    case "rejected": return { label: "Rejected", cls: "border-danger-bright/50 text-danger-bright" };
    case "archived": return { label: "Archived", cls: "border-ink-dim/50 text-ink-muted" };
    default: return { label: status, cls: "border-gold/20 text-ink-muted" };
  }
};

const inputCls =
  "mt-2 min-h-12 w-full rounded-xl border border-gold/25 bg-[#0b0b0b] px-4 text-ink outline-none placeholder:text-ink-dim focus:border-gold/60";
const labelCls = "block text-xs font-semibold uppercase tracking-wider text-gold";

function Stepper({ step }: { step: number }) {
  return (
    <ol className="flex items-center gap-2 sm:gap-3" aria-label="Progress">
      {STEP_TITLES.map((title, i) => {
        const n = i + 1;
        const done = n < step;
        const current = n === step;
        return (
          <li key={title} className="flex min-w-0 flex-1 items-center gap-2" aria-current={current ? "step" : undefined}>
            <span
              className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border text-[10px] font-bold transition-colors sm:h-7 sm:w-7 sm:text-xs ${
                done ? "border-gold bg-gold text-[#111111]" : current ? "border-gold text-gold" : "border-gold/25 text-ink-dim"
              }`}
            >
              {done ? <Check className="h-3.5 w-3.5" aria-hidden /> : n}
            </span>
            <span className={`hidden truncate text-[10px] font-semibold uppercase tracking-[0.14em] sm:block ${current ? "text-gold" : "text-ink-muted"}`}>
              {title}
            </span>
            {n < STEP_TITLES.length && <span aria-hidden className="hidden h-px flex-1 bg-gold/20 lg:block" />}
          </li>
        );
      })}
    </ol>
  );
}

function MySubmissions({ items }: { items: Submission[] }) {
  if (items.length === 0) return null;
  return (
    <section aria-labelledby="my-submissions" className="rounded-2xl border border-gold/20 bg-surface-raised/60 p-5 backdrop-blur-md">
      <p id="my-submissions" className="text-xs font-semibold uppercase tracking-[.18em] text-gold">My submissions</p>
      <ul className="mt-3 divide-y divide-gold/10">
        {items.map((s) => {
          const pill = submissionPill(s.status);
          return (
            <li key={s.id} className="flex items-start justify-between gap-3 py-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-ink">{s.title}</p>
                <p className="mt-0.5 text-[11px] text-ink-muted">
                  {new Date(s.starts_at).toLocaleDateString("en-NG", { dateStyle: "medium" })}
                  {s.category ? ` · ${s.category}` : ""}
                  {s.fee_ref ? <> · <span className="font-mono text-gold/80">{s.fee_ref}</span></> : null}
                </p>
              </div>
              <span className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${pill.cls}`}>
                {pill.label}
              </span>
            </li>
          );
        })}
      </ul>
      <p className="mt-2 text-[11px] text-ink-dim">Submissions stay private until our review team approves them. Your publishing fee is collected only at submission.</p>
    </section>
  );
}

export function CreateEventScreen() {
  const [cfg, setCfg] = useState<Config | null>(null);
  const [cfgError, setCfgError] = useState("");
  const [step, setStep] = useState(1);

  const [title, setTitle] = useState("");
  const [category, setCategory] = useState<string>(CATEGORIES[0]);
  const [startAt, setStartAt] = useState("");
  const [endAt, setEndAt] = useState("");
  const [venueName, setVenueName] = useState("");
  const [venueAddress, setVenueAddress] = useState("");
  const [city, setCity] = useState("");
  const [description, setDescription] = useState("");
  const [tiers, setTiers] = useState<TicketTier[]>([newTier()]);

  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [insufficient, setInsufficient] = useState<{ availableMinor?: number; feeMinor: number } | null>(null);
  const [result, setResult] = useState<{ ref: string; feeMinor: number; availableMinor?: number; status?: string } | null>(null);

  const loadConfig = useCallback(async () => {
    try {
      const res = await fetch("/api/create-event", { cache: "no-store" });
      const body = (await res.json().catch(() => null)) as Config | null;
      if (!res.ok || !body) throw new Error("cfg_failed");
      setCfg(body);
      setCfgError("");
    } catch {
      setCfgError("Could not load event creation. Please refresh.");
    }
  }, []);

  useEffect(() => { void loadConfig(); }, [loadConfig]);

  // Restore draft (client-only)
  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(DRAFT_KEY);
      if (!raw) return;
      const d = JSON.parse(raw) as Partial<{ title: string; category: string; startAt: string; endAt: string; venueName: string; venueAddress: string; city: string; description: string; tiers: TicketTier[] }>;
      if (typeof d.title === "string") setTitle(d.title);
      if (typeof d.category === "string") setCategory(d.category);
      if (typeof d.startAt === "string") setStartAt(d.startAt);
      if (typeof d.endAt === "string") setEndAt(d.endAt);
      if (typeof d.venueName === "string") setVenueName(d.venueName);
      if (typeof d.venueAddress === "string") setVenueAddress(d.venueAddress);
      if (typeof d.city === "string") setCity(d.city);
      if (typeof d.description === "string") setDescription(d.description);
      if (Array.isArray(d.tiers) && d.tiers.length > 0) setTiers(d.tiers);
    } catch { /* corrupt draft — start fresh */ }
  }, []);

  // Persist draft
  useEffect(() => {
    const d = { title, category, startAt, endAt, venueName, venueAddress, city, description, tiers };
    try { window.localStorage.setItem(DRAFT_KEY, JSON.stringify(d)); } catch { /* quota */ }
  }, [title, category, startAt, endAt, venueName, venueAddress, city, description, tiers]);

  const step1Valid = title.trim().length >= 3 && startAt.trim() !== "" && (!endAt || new Date(endAt) > new Date(startAt));
  const step2Valid = description.trim().length >= 20;
  const step3Valid = tiers.length >= 1 && tiers.every((t) => t.name.trim().length >= 2);
  const canContinue = step === 1 ? step1Valid : step === 2 ? step2Valid : step === 3 ? step3Valid : true;

  const feeMinor = cfg?.feeMinor ?? 0;
  const frozen = cfg?.frozen === true;

  function setTier(id: string, patch: Partial<TicketTier>) {
    setTiers((prev) => prev.map((t) => (t.id === id ? { ...t, ...patch } : t)));
  }
  function removeTier(id: string) {
    setTiers((prev) => (prev.length > 1 ? prev.filter((t) => t.id !== id) : prev));
  }

  const totalCapacity = useMemo(() => tiers.reduce((acc, t) => acc + (t.quantity.trim() === "" ? 0 : Number(t.quantity) || 0), 0), [tiers]);

  async function submit() {
    if (submitting) return;
    setSubmitting(true);
    setSubmitError("");
    setInsufficient(null);
    const body = {
      title: title.trim(),
      category: category || null,
      description: description.trim(),
      venueName: venueName.trim() || null,
      venueAddress: venueAddress.trim() || null,
      city: city.trim() || null,
      startsAt: new Date(startAt).toISOString(),
      endsAt: endAt ? new Date(endAt).toISOString() : null,
      tickets: tiers.map((t) => ({
        name: t.name.trim(),
        priceMinor: Math.max(0, Math.round((Number(t.price.replace(/[^\d.]/g, "")) || 0) * 100)),
        quantity: t.quantity.trim() === "" ? null : Math.max(1, Math.floor(Number(t.quantity)) || 1),
      })),
    };
    try {
      const res = await fetch("/api/create-event", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({}));
      if (res.status === 201) {
        setResult({ ref: data.ref ?? "", feeMinor: data.feeMinor ?? feeMinor, availableMinor: data.availableMinor, status: data.status });
        try { window.localStorage.removeItem(DRAFT_KEY); } catch { /* ignore */ }
        void loadConfig();
        return;
      }
      if (res.status === 409 && data?.error === "insufficient_funds") {
        setInsufficient({ availableMinor: data.availableMinor, feeMinor: data.feeMinor ?? feeMinor });
        return;
      }
      setSubmitError(typeof data?.error === "string" ? data.error : "Could not submit your event. Please try again.");
    } catch {
      setSubmitError("Network error. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  const walletCardCls = "rounded-2xl border border-gold/25 bg-[#111111]/85 p-5 backdrop-blur-md sm:p-6";

  if (cfgError) {
    return <section className="mx-auto w-full max-w-2xl px-4 py-12"><p role="alert" className="rounded-2xl border border-danger-bright/40 p-5 text-sm text-danger-bright">{cfgError}</p></section>;
  }

  // Success screen
  if (result) {
    return (
      <section className="mx-auto w-full max-w-2xl px-4 py-10">
        <div className={`${walletCardCls} text-center`}>
          <PartyPopper className="mx-auto h-12 w-12 text-gold" aria-hidden />
          <h1 className="mt-3 font-display text-3xl text-ink">Submitted for review</h1>
          <p className="mt-2 text-sm text-ink-muted">
            Your publishing fee of <span className="font-semibold text-ink">{formatMoney(result.feeMinor / 100, "NGN")}</span> was collected.
            Reference <span className="font-mono text-gold">{result.ref}</span>.
          </p>
          <p className="mt-3 text-sm text-ink-muted">Our team reviews every event before it goes live. Expect a decision before your event date — you will be notified by email once it is approved and listed.</p>
          <div className="mt-6 grid gap-3 sm:grid-cols-3">
            <Link href="/events" className="min-h-12 rounded-xl border border-gold/30 px-3 py-3 text-sm font-semibold text-gold transition-colors hover:bg-gold/10">Browse events</Link>
            <Link href="/wallet" className="min-h-12 rounded-xl border border-gold/30 px-3 py-3 text-sm font-semibold text-gold transition-colors hover:bg-gold/10">View wallet</Link>
            <button type="button" onClick={() => { setResult(null); setStep(1); setTitle(""); setDescription(""); setVenueName(""); setVenueAddress(""); setCity(""); setStartAt(""); setEndAt(""); setTiers([newTier()]); }} className="min-h-12 rounded-xl bg-gold px-3 py-3 text-sm font-semibold text-[#111111]">Create another</button>
          </div>
        </div>
        {cfg && <div className="mt-6"><MySubmissions items={cfg.submissions} /></div>}
      </section>
    );
  }

  return (
    <section className="mx-auto w-full max-w-3xl space-y-6 px-4 py-8">
      <header className={walletCardCls}>
        <p className="text-xs font-semibold uppercase tracking-[.22em] text-gold">Create an event</p>
        <h1 className="mt-1 font-display text-3xl text-ink sm:text-4xl">Bring the night to life.</h1>
        <p className="mt-2 text-sm text-ink-muted">Build your listing in four steps. A one-off publishing fee keeps /events premium — collected from your wallet at submission, reviewed by our team, then listed.</p>
        <div className="mt-4"><Stepper step={step} /></div>
      </header>

      {cfg && !cfg.walletEnabled ? (
        <div className={walletCardCls}>
          <p className="text-xs font-semibold uppercase tracking-[.18em] text-gold">Launching soon</p>
          <p className="mt-2 text-sm text-ink-muted">Event creation opens together with the HS86E Wallet. Signed-in creators will publish in minutes with one wallet fee.</p>
        </div>
      ) : (
        <div className={walletCardCls}>
          {frozen && (
            <p role="status" className="mb-4 rounded-lg border border-gold/30 bg-gold/5 px-3 py-2 text-xs text-gold">
              Publishing fees are paused while the wallet is frozen for maintenance. You can draft freely; the pay button returns when we are back.
            </p>
          )}

          {step === 1 && (
            <div className="space-y-4">
              <div>
                <label className={labelCls} htmlFor="ev-title">Event title *</label>
                <input id="ev-title" type="text" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Afrobeats Under The Stars" className={inputCls} maxLength={140} autoFocus />
              </div>
              <div>
                <label className={labelCls} htmlFor="ev-category"><Tag className="mr-1 inline h-3.5 w-3.5 align-[-2px]" aria-hidden />Category</label>
                <select id="ev-category" value={category} onChange={(e) => setCategory(e.target.value)} className={inputCls}>
                  {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className={labelCls} htmlFor="ev-start"><CalendarDays className="mr-1 inline h-3.5 w-3.5 align-[-2px]" aria-hidden />Starts *</label>
                  <input id="ev-start" type="datetime-local" value={startAt} onChange={(e) => setStartAt(e.target.value)} className={inputCls} />
                </div>
                <div>
                  <label className={labelCls} htmlFor="ev-end">Ends (optional)</label>
                  <input id="ev-end" type="datetime-local" value={endAt} onChange={(e) => setEndAt(e.target.value)} className={inputCls} />
                </div>
              </div>
              {endAt && startAt && new Date(endAt) <= new Date(startAt) && (
                <p role="alert" className="text-xs text-danger-bright">End time must be after the start time.</p>
              )}
              <div>
                <label className={labelCls} htmlFor="ev-venue"><MapPin className="mr-1 inline h-3.5 w-3.5 align-[-2px]" aria-hidden />Venue name</label>
                <input id="ev-venue" type="text" value={venueName} onChange={(e) => setVenueName(e.target.value)} placeholder="Landmark Event Centre" className={inputCls} maxLength={120} />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className={labelCls} htmlFor="ev-address">Venue address</label>
                  <input id="ev-address" type="text" value={venueAddress} onChange={(e) => setVenueAddress(e.target.value)} placeholder="12 Adeola Odeku St" className={inputCls} maxLength={200} />
                </div>
                <div>
                  <label className={labelCls} htmlFor="ev-city">City / Area</label>
                  <input id="ev-city" type="text" value={city} onChange={(e) => setCity(e.target.value)} placeholder="Victoria Island, Lagos" className={inputCls} maxLength={80} />
                </div>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-4">
              <div>
                <label className={labelCls} htmlFor="ev-description"><AlignLeft className="mr-1 inline h-3.5 w-3.5 align-[-2px]" aria-hidden />What should guests expect? *</label>
                <textarea id="ev-description" rows={7} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Line-up, dress code, age policy, entry rules, what is included…" className={inputCls} maxLength={4000} autoFocus />
                <p className={`mt-2 text-xs ${description.trim().length >= 20 ? "text-ink-dim" : "text-amber-bright"}`}>
                  {description.trim().length}/20 characters minimum
                </p>
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-4">
              <p className={labelCls}><Ticket className="mr-1 inline h-3.5 w-3.5 align-[-2px]" aria-hidden />Ticket tiers *</p>
              <p className="-mt-2 text-xs text-ink-muted">Leave price empty or 0 for a free tier. Leave quantity empty for unlimited. Total capacity{totalCapacity > 0 ? `: ${totalCapacity.toLocaleString()}` : ": unlimited"}.</p>
              {tiers.map((tier) => (
                <div key={tier.id} className="grid grid-cols-[1fr_5.5rem_5.5rem_2.5rem] items-end gap-2 sm:grid-cols-[1fr_7rem_7rem_2.5rem]">
                  <div>
                    <label className="text-[10px] font-semibold uppercase tracking-wider text-ink-muted" htmlFor={`tier-name-${tier.id}`}>Tier</label>
                    <input id={`tier-name-${tier.id}`} type="text" value={tier.name} onChange={(e) => setTier(tier.id, { name: e.target.value })} placeholder="Early Bird" className={inputCls} maxLength={60} />
                  </div>
                  <div>
                    <label className="text-[10px] font-semibold uppercase tracking-wider text-ink-muted" htmlFor={`tier-price-${tier.id}`}>Price ₦</label>
                    <input id={`tier-price-${tier.id}`} type="text" inputMode="decimal" value={tier.price} onChange={(e) => setTier(tier.id, { price: e.target.value })} placeholder="0 = Free" className={inputCls} />
                  </div>
                  <div>
                    <label className="text-[10px] font-semibold uppercase tracking-wider text-ink-muted" htmlFor={`tier-qty-${tier.id}`}>Qty</label>
                    <input id={`tier-qty-${tier.id}`} type="text" inputMode="numeric" value={tier.quantity} onChange={(e) => setTier(tier.id, { quantity: e.target.value.replace(/\D/g, "") })} placeholder="∞" className={inputCls} />
                  </div>
                  <button type="button" onClick={() => removeTier(tier.id)} disabled={tiers.length === 1} aria-label="Remove tier"
                    className="flex h-12 items-center justify-center rounded-xl border border-gold/15 text-ink-muted transition-colors hover:text-danger-bright disabled:opacity-30">
                    <Trash2 className="h-4 w-4" aria-hidden />
                  </button>
                </div>
              ))}
              {tiers.length < 10 && (
                <button type="button" onClick={() => setTiers((prev) => [...prev, newTier()])}
                  className="flex min-h-12 w-full items-center justify-center gap-2 rounded-xl border border-dashed border-gold/30 text-sm font-semibold text-gold transition-colors hover:bg-gold/5">
                  <Plus className="h-4 w-4" aria-hidden /> Add another tier
                </button>
              )}
            </div>
          )}

          {step === 4 && (
            <div className="space-y-4">
              <p className={labelCls}>Review your event</p>
              <dl className="divide-y divide-gold/10 rounded-xl border border-gold/15">
                {[
                  ["Title", title.trim() || "—"],
                  ["Category", category || "—"],
                  ["When", startAt ? new Date(startAt).toLocaleString("en-NG", { dateStyle: "full", timeStyle: "short" }) : "—"],
                  ["Where", [venueName.trim(), venueAddress.trim(), city.trim()].filter(Boolean).join(" · ") || "Venue to be confirmed"],
                  ["Tickets", tiers.map((t) => `${t.name.trim() || "Tier"} — ${(Number(t.price.replace(/[^\d.]/g, "")) || 0) === 0 ? "Free" : formatMoney(Number(t.price.replace(/[^\d.]/g, "")) || 0, "NGN")}${t.quantity.trim() ? ` ×${t.quantity}` : ""}`).join(" · ")],
                ].map(([k, v]) => (
                  <div key={k as string} className="grid grid-cols-[5.5rem_1fr] gap-3 px-4 py-3 sm:grid-cols-[7rem_1fr]">
                    <dt className="text-[10px] font-semibold uppercase tracking-[0.18em] text-ink-dim">{k as string}</dt>
                    <dd className="text-sm text-ink">{v as string}</dd>
                  </div>
                ))}
              </dl>
              <div className="rounded-xl border border-gold/25 bg-gold/5 p-4">
                <div className="flex items-center justify-between gap-3">
                  <span className="flex items-center gap-2 text-sm font-semibold text-gold"><Wallet className="h-4 w-4" aria-hidden />Publishing fee</span>
                  <span className="text-lg font-bold text-ink">{cfg ? formatMoney(feeMinor / 100, "NGN") : "…"}</span>
                </div>
                <p className="mt-1 text-xs text-ink-muted">One-off, non-refundable once submitted. Paid from your HS86E wallet balance; the event lists only after our review team approves it.</p>
              </div>
              {insufficient && (
                <div role="alert" className="rounded-xl border border-danger-bright/40 p-4">
                  <p className="text-sm font-semibold text-danger-bright">Not enough wallet balance</p>
                  <p className="mt-1 text-xs text-ink-muted">
                    You have {formatMoney((insufficient.availableMinor ?? 0) / 100, "NGN")} available; the fee is {formatMoney(insufficient.feeMinor / 100, "NGN")}.
                  </p>
                  <Link href="/wallet" className="mt-3 inline-flex min-h-11 items-center rounded-xl bg-gold px-4 text-sm font-semibold text-[#111111]">Top up wallet</Link>
                </div>
              )}
              {submitError && <p role="alert" className="text-sm text-danger-bright">{submitError}</p>}
            </div>
          )}

          <div className="mt-6 flex items-center justify-between gap-3 border-t border-gold/10 pt-4">
            {step > 1 ? (
              <button type="button" onClick={() => setStep((s) => Math.max(1, s - 1))} className="flex min-h-12 items-center gap-2 rounded-xl border border-gold/25 px-4 text-sm font-semibold text-gold transition-colors hover:bg-gold/10">
                <ArrowLeft className="h-4 w-4" aria-hidden /> Back
              </button>
            ) : <span />}
            {step < 4 ? (
              <button type="button" disabled={!canContinue} onClick={() => setStep((s) => Math.min(4, s + 1))}
                className="flex min-h-12 items-center gap-2 rounded-xl bg-gold px-5 text-sm font-semibold text-[#111111] transition-opacity disabled:opacity-40">
                Continue <ArrowRight className="h-4 w-4" aria-hidden />
              </button>
            ) : (
              <button type="button" disabled={submitting || frozen || insufficient !== null} onClick={() => void submit()}
                className="flex min-h-12 items-center gap-2 rounded-xl bg-gold px-5 text-sm font-semibold text-[#111111] transition-opacity disabled:opacity-40">
                {submitting ? <><Loader2 className="h-4 w-4 animate-spin" aria-hidden /> Submitting…</> : <>Pay {cfg ? formatMoney(feeMinor / 100, "NGN") : ""} &amp; submit</>}
              </button>
            )}
          </div>
        </div>
      )}

      {cfg && <MySubmissions items={cfg.submissions} />}
    </section>
  );
}
