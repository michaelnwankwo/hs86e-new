import type { Metadata, Viewport } from "next";
import Script from "next/script";
import { Cinzel, Outfit } from "next/font/google";
import { AppFooter } from "@/components/layout/AppFooter";
import { AppHeader } from "@/components/layout/AppHeader";
import { BottomNav } from "@/components/layout/BottomNav";
import { Providers } from "@/components/layout/Providers";
import { PWAInstallButton } from "@/components/pwa/PWAInstallButton";
import { IosInstallBanner } from "@/components/pwa/IosInstallBanner";
import { BRAND, LOGO_PATH } from "@/lib/constants";
import "@/styles/globals.css";

const display = Cinzel({
  subsets: ["latin"],
  variable: "--font-display",
  weight: ["500", "600", "700"],
});

const sans = Outfit({
  subsets: ["latin"],
  variable: "--font-sans",
  weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"),
  title: {
    default: `${BRAND.shortName} · Tickets`,
    template: `%s · ${BRAND.shortName}`,
  },
  description: BRAND.tagline,
  applicationName: "HS86E",
  manifest: "/manifest.json",
  icons: {
    icon: [
      { url: "/icons/favicon-32.png", sizes: "32x32", type: "image/png" },
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/icons/apple-touch-icon.png", sizes: "180x180" }],
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "HS86E",
  },
  other: {
    "apple-mobile-web-app-capable": "yes",
    "apple-mobile-web-app-status-bar-style": "black-translucent",
    "apple-mobile-web-app-title": "HS86E",
    "mobile-web-app-capable": "yes",
  },
  openGraph: {
    title: "HS86E Tickets",
    description: BRAND.tagline,
    images: [LOGO_PATH],
  },
};

export const viewport: Viewport = {
  themeColor: "#0B0E14",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  viewportFit: "cover",
  colorScheme: "dark",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${display.variable} ${sans.variable}`}>
      <head>
        <link rel="manifest" href="/manifest.json" />
        <link rel="apple-touch-icon" href="/icons/icon-192x192.png" />
        <link rel="apple-touch-icon" sizes="180x180" href="/icons/apple-touch-icon.png" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content="HS86E" />
        <meta name="mobile-web-app-capable" content="yes" />
      </head>
      <body className="font-sans">
        <Script id="hs86e-pwa-prompt" strategy="beforeInteractive">
          {`window.__HS86E_DEFERRED_PROMPT=null;window.addEventListener("beforeinstallprompt",function(e){e.preventDefault();window.__HS86E_DEFERRED_PROMPT=e;window.dispatchEvent(new Event("hs86e-install-ready"));});`}
        </Script>
        <Providers>
          <AppHeader />
          <main className="safe-bottom mx-auto min-h-[calc(100dvh-4rem)] max-w-3xl">{children}</main>
          <AppFooter />
          <BottomNav />
          <PWAInstallButton />
          <IosInstallBanner />
        </Providers>
      </body>
    </html>
  );
}
