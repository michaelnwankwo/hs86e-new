import { z } from "zod";

const optionalUrl = z
  .string()
  .optional()
  .transform((v) => (v && v.trim().length > 0 ? v.trim().replace(/\/$/, "") : undefined));

const optionalString = z
  .string()
  .optional()
  .transform((v) => {
    if (!v) return undefined;
    const trimmed = v.trim().replace(/^["']|["']$/g, "").trim();
    return trimmed.length > 0 ? trimmed : undefined;
  });

/** Optional secret that must be at least 24 chars when provided (defense in depth). */
const optionalSecret = optionalString.refine((v) => v === undefined || v.length >= 24, {
  message: "must be at least 24 characters when set",
});

const schema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  NEXT_PUBLIC_APP_URL: z.string().default("http://localhost:3000"),
  DEMO_MODE: z
    .string()
    .optional()
    .transform((v) => v === "true" || v === "1"),

  WP_BASE_URL: optionalUrl,
  WC_CONSUMER_KEY: optionalString,
  WC_CONSUMER_SECRET: optionalString,
  WP_APP_USER: optionalString,
  WP_APP_PASSWORD: optionalString,

  STRIPE_SECRET_KEY: optionalString,
  STRIPE_WEBHOOK_SECRET: optionalString,
  NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: optionalString,

  FLW_SECRET_KEY: optionalString,
  FLW_WEBHOOK_HASH: optionalString,
  NEXT_PUBLIC_FLW_PUBLIC_KEY: optionalString,

  SCAN_STAFF_PIN: optionalString,
  SCAN_STAFF_PIN_HASH: optionalString,
  /**
   * Optional at the schema layer so a missing/short secret NEVER crashes page
   * renders (the old `.min(24)` hard requirement threw inside Server Components
   * and produced the production "Server-side exception (digest)" error page).
   * The door-scanner auth boundary enforces it instead — see requireScanSecret()
   * in src/lib/auth.ts — failing closed when it is absent.
   */
  SCAN_JWT_SECRET: optionalString.refine((v) => v === undefined || v.length >= 24, {
    message: "SCAN_JWT_SECRET must be at least 24 characters when set",
  }),
  /** Dedicated key for QR HMAC signing. Falls back to SCAN_JWT_SECRET when unset
   *  (old passes stay valid; verification tries every configured key). */
  TICKET_HMAC_SECRET: optionalSecret,
  SCAN_DEFAULT_EVENT_ID: optionalString,
  REVALIDATE_SECRET: optionalString,
  RESEND_API_KEY: optionalString,
  RESEND_FROM: optionalString,

  /** WooCommerce product category slug that holds event tickets. Empty = auto-detect FooEvents products. */
  WC_CATEGORY_SLUG: optionalString,
  /** When true, list every published product if no event-tickets category / FooEvents meta is found. */
  WC_INCLUDE_ALL_PRODUCTS: z
    .string()
    .optional()
    .transform((v) => v === "true" || v === "1"),
});

export type AppEnv = z.infer<typeof schema>;

let cached: AppEnv | null = null;

export function getEnv(): AppEnv {
  if (cached && process.env.NODE_ENV === "production") return cached;
  const parsed = schema.safeParse({
    NODE_ENV: process.env.NODE_ENV,
    NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
    DEMO_MODE: process.env.DEMO_MODE,
    WP_BASE_URL: process.env.WP_BASE_URL,
    WC_CONSUMER_KEY: process.env.WC_CONSUMER_KEY,
    WC_CONSUMER_SECRET: process.env.WC_CONSUMER_SECRET,
    WP_APP_USER: process.env.WP_APP_USER,
    WP_APP_PASSWORD: process.env.WP_APP_PASSWORD,
    STRIPE_SECRET_KEY: process.env.STRIPE_SECRET_KEY,
    STRIPE_WEBHOOK_SECRET: process.env.STRIPE_WEBHOOK_SECRET,
    NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY,
    FLW_SECRET_KEY: process.env.FLW_SECRET_KEY,
    FLW_WEBHOOK_HASH: process.env.FLW_WEBHOOK_HASH,
    NEXT_PUBLIC_FLW_PUBLIC_KEY: process.env.NEXT_PUBLIC_FLW_PUBLIC_KEY,
    SCAN_STAFF_PIN: process.env.SCAN_STAFF_PIN,
    SCAN_STAFF_PIN_HASH: process.env.SCAN_STAFF_PIN_HASH,
    SCAN_JWT_SECRET: process.env.SCAN_JWT_SECRET,
    TICKET_HMAC_SECRET: process.env.TICKET_HMAC_SECRET,
    SCAN_DEFAULT_EVENT_ID: process.env.SCAN_DEFAULT_EVENT_ID,
    REVALIDATE_SECRET: process.env.REVALIDATE_SECRET,
    RESEND_API_KEY: process.env.RESEND_API_KEY,
    RESEND_FROM: process.env.RESEND_FROM,
    WC_CATEGORY_SLUG: process.env.WC_CATEGORY_SLUG,
    WC_INCLUDE_ALL_PRODUCTS: process.env.WC_INCLUDE_ALL_PRODUCTS,
  });
  if (!parsed.success) {
    const issues = parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ");
    throw new Error(`Invalid environment: ${issues}`);
  }
  cached = parsed.data;
  return cached;
}

/**
 * Degraded configuration used whenever the process environment fails schema
 * validation (e.g. a secret is set but malformed). Everything optional becomes
 * undefined so the app behaves as "unconfigured" instead of crashing — pages
 * render their fallback UI and API routes answer with structured JSON errors.
 */
function fallbackEnv(): AppEnv {
  let nodeEnv: AppEnv["NODE_ENV"] = "development";
  if (process.env.NODE_ENV === "production" || process.env.NODE_ENV === "test") {
    nodeEnv = process.env.NODE_ENV;
  }
  return schema.parse({ NODE_ENV: nodeEnv, NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL });
}

let warnedFallback = false;
let safeCached: AppEnv | null = null;

/**
 * Fail-soft environment accessor. NEVER throws — safe for Server Components,
 * metadata generation, and any request-time code path that must always render.
 */
export function getEnvSafe(): AppEnv {
  if (safeCached && process.env.NODE_ENV === "production") return safeCached;
  try {
    const env = getEnv();
    safeCached = env;
    return env;
  } catch (err) {
    if (!warnedFallback) {
      warnedFallback = true;
      console.warn(
        `[hs86e] Environment validation failed — running with degraded config. ${
          err instanceof Error ? err.message : err
        }`,
      );
    }
    const env = fallbackEnv();
    safeCached = env;
    return env;
  }
}

/**
 * Human-readable description of the configuration problem, or null when the
 * environment is valid. Used for health checks and graceful UI messaging.
 */
export function getEnvIssues(): string | null {
  try {
    getEnv();
    return null;
  } catch (err) {
    return err instanceof Error ? err.message : String(err);
  }
}

export function hasWooCommerce() {
  const env = getEnvSafe();
  return Boolean(env.WP_BASE_URL && env.WC_CONSUMER_KEY && env.WC_CONSUMER_SECRET);
}

export function hasFooEventsAuth() {
  const env = getEnvSafe();
  return Boolean(env.WP_BASE_URL && env.WP_APP_USER && env.WP_APP_PASSWORD);
}

export function isDemoMode() {
  return getEnvSafe().DEMO_MODE;
}

export function hasStripe() {
  return getEnvSafe().STRIPE_SECRET_KEY !== undefined;
}

export function hasFlutterwave() {
  return getEnvSafe().FLW_SECRET_KEY !== undefined;
}

/** True when a usable door-scanner signing secret (>= 24 chars) is configured. */
export function hasScanSecret() {
  const secret = getEnvSafe().SCAN_JWT_SECRET;
  return typeof secret === "string" && secret.length >= 24;
}

export function appUrl() {
  return getEnvSafe().NEXT_PUBLIC_APP_URL.replace(/\/$/, "");
}
