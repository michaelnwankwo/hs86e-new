import { clsx, type ClassValue } from "clsx";

export function cn(...inputs: ClassValue[]) {
  return clsx(inputs);
}

export function formatMoney(amount: number, currency = "NGN") {
  try {
    return new Intl.NumberFormat("en-NG", {
      style: "currency",
      currency,
      maximumFractionDigits: currency === "NGN" ? 0 : 2,
    }).format(amount);
  } catch {
    return `${currency} ${amount.toLocaleString()}`;
  }
}

export function formatCardDate(iso: string) {
  try {
    const date = new Date(iso);
    if (Number.isNaN(date.getTime())) return iso;
    const weekday = new Intl.DateTimeFormat("en-GB", { weekday: "short" }).format(date);
    const day = new Intl.DateTimeFormat("en-GB", { day: "numeric" }).format(date);
    const month = new Intl.DateTimeFormat("en-GB", { month: "short" }).format(date);
    const year = new Intl.DateTimeFormat("en-GB", { year: "numeric" }).format(date);
    return `${weekday} ${day} ${month} ${year}`;
  } catch {
    return iso;
  }
}

export function formatVenue(venue: { name?: string; address?: string; city?: string }) {
  return [venue.name, venue.address, venue.city].filter(Boolean).join(", ");
}

export function formatWhen(iso: string) {
  try {
    return new Intl.DateTimeFormat("en-NG", {
      weekday: "short",
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

export function formatTime(iso: string) {
  try {
    return new Intl.DateTimeFormat("en-NG", {
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

export function stripHtml(html: string) {
  return html
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#8217;|&rsquo;|&#39;|&apos;/g, "'")
    .replace(/&#8211;|&ndash;/g, "–")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\s+/g, " ")
    .trim();
}

export function randomId(prefix = "hs") {
  const bytes = new Uint8Array(8);
  if (typeof crypto !== "undefined" && crypto.getRandomValues) {
    crypto.getRandomValues(bytes);
  } else {
    for (let i = 0; i < bytes.length; i += 1) bytes[i] = Math.floor(Math.random() * 256);
  }
  return (
    prefix +
    Array.from(bytes)
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("")
  );
}

export function getOrCreateDeviceId() {
  if (typeof window === "undefined") return "server";
  const existing = window.localStorage.getItem("hs86e_device_id");
  if (existing) return existing;
  const id = randomId("door");
  window.localStorage.setItem("hs86e_device_id", id);
  return id;
}

export function safeJson<T>(value: string | null, fallback: T): T {
  if (!value) return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

export function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value.trim());
}

export function isTicketIdShape(value: string) {
  return /^(TKT-)?[A-Za-z0-9_-]{4,48}$/i.test(value.trim());
}

export async function copyText(value: string) {
  if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(value);
      return true;
    } catch {
      // execCommand fallback below
    }
  }
  if (typeof document === "undefined") return false;
  const el = document.createElement("textarea");
  el.value = value;
  el.setAttribute("readonly", "");
  el.style.position = "fixed";
  el.style.left = "-9999px";
  document.body.appendChild(el);
  el.select();
  el.setSelectionRange(0, value.length);
  const ok = document.execCommand("copy");
  document.body.removeChild(el);
  return ok;
}
