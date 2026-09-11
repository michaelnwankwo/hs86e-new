import withSerwistInit from "@serwist/next";

const withSerwist = withSerwistInit({
  swSrc: "src/app/sw.ts",
  swDest: "public/sw.js",
  disable: process.env.NODE_ENV === "development",
});

// ws: is only required for Next.js dev HMR on localhost; production needs wss: only.
const connectSrc =
  process.env.NODE_ENV === "production"
    ? "'self' https: wss:"
    : "'self' https: wss: ws:";

const CSP = [
  "default-src 'self'",
  // Next.js App Router inline bootstrap scripts + runtime-injected providers:
  "script-src 'self' 'unsafe-inline' https://js.stripe.com https://checkout.flutterwave.com",
  "style-src 'self' 'unsafe-inline'",
  // Event artwork lives on arbitrary WooCommerce / CDN origins:
  "img-src 'self' data: blob: https:",
  "font-src 'self' data:",
  "connect-src " + connectSrc,
  // Stripe / Flutterwave hosted-checkout iframes:
  "frame-src 'self' https://checkout.stripe.com https://js.stripe.com https://checkout.flutterwave.com https://*.flutterwave.com https://*.ravemodal.com",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self' https://checkout.stripe.com https://checkout.flutterwave.com",
  "frame-ancestors 'none'",
  "worker-src 'self'",
].join("; ");

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  devIndicators: false,
  images: {
    formats: ["image/avif", "image/webp"],
    dangerouslyAllowSVG: false,
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "Content-Security-Policy", value: CSP },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          {
            key: "Permissions-Policy",
            value: "camera=(self), microphone=(), geolocation=()",
          },
          {
            key: "Strict-Transport-Security",
            value: "max-age=31536000; includeSubDomains",
          },
        ],
      },
      {
        source: "/api/events",
        headers: [{ key: "Cache-Control", value: "no-store, max-age=0" }],
      },
      {
        source: "/events",
        headers: [{ key: "Cache-Control", value: "no-store, max-age=0" }],
      },
    ];
  },
};

export default withSerwist(nextConfig);
