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
  SCAN_JWT_SECRET: z.string().min(24, "SCAN_JWT_SECRET must be at least 24 characters"),
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

export function hasWooCommerce() {
  const env = getEnv();
  return Boolean(env.WP_BASE_URL && env.WC_CONSUMER_KEY && env.WC_CONSUMER_SECRET);
}

export function hasFooEventsAuth() {
  const env = getEnv();
  return Boolean(env.WP_BASE_URL && env.WP_APP_USER && env.WP_APP_PASSWORD);
}

export function isDemoMode() {
  return getEnv().DEMO_MODE;
}

export function hasStripe() {
  const env = getEnv();
  return Boolean(env.STRIPE_SECRET_KEY);
}

export function hasFlutterwave() {
  const env = getEnv();
  return Boolean(env.FLW_SECRET_KEY);
}

export function appUrl() {
  return getEnv().NEXT_PUBLIC_APP_URL.replace(/\/$/, "");
}
