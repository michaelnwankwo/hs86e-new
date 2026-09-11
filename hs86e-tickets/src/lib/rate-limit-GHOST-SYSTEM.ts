type Bucket = { count: number; resetAt: number };

const buckets = new Map<string, Bucket>();
let lastSweep = 0;

/**
 * Periodic prune so the in-memory buckets cannot grow without bound
 * (memory-exhaustion DoS under many distinct keys). Runs at most once per
 * minute, or sooner if the map has grown very large.
 */
function sweep(now: number) {
  if (now - lastSweep < 60_000 && buckets.size < 20_000) return;
  lastSweep = now;
  for (const [key, bucket] of buckets) {
    if (bucket.resetAt < now) buckets.delete(key);
  }
}

export function rateLimit(key: string, max: number, windowMs: number) {
  const now = Date.now();
  sweep(now);
  const current = buckets.get(key);
  if (!current || current.resetAt < now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { ok: true, remaining: max - 1, resetAt: now + windowMs };
  }
  if (current.count >= max) {
    return { ok: false, remaining: 0, resetAt: current.resetAt };
  }
  current.count += 1;
  return { ok: true, remaining: max - current.count, resetAt: current.resetAt };
}

function looksLikeIp(value: string) {
  const v = value.trim();
  if (!v) return false;
  if (/^\d{1,3}(?:\.\d{1,3}){3}$/.test(v)) return true;
  return v.includes(":") && /^[0-9a-fA-F:.]+$/.test(v);
}

/**
 * Resolve the client IP from proxy headers. We read X-Forwarded-For from the
 * RIGHT (the entry appended by the nearest trusted proxy — Netlify's edge) and
 * skip any non-IP junk, so a caller cannot spoof the first hop and evade
 * per-IP rate limits.
 */
export function clientIp(request: Request) {
  const xf = request.headers.get("x-forwarded-for");
  if (xf) {
    const parts = xf.split(",").map((s) => s.trim()).filter(Boolean);
    for (let i = parts.length - 1; i >= 0; i -= 1) {
      if (looksLikeIp(parts[i])) return parts[i];
    }
  }
  const real = request.headers.get("x-real-ip");
  if (real && looksLikeIp(real)) return real;
  return "unknown";
}
