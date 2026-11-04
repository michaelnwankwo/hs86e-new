export const SITE_URL = (
  process.env.NEXT_PUBLIC_APP_URL || "https://hs86eapp.netlify.app"
).replace(/\/+$/, "");

export function siteUrl(path: string): string {
  return `${SITE_URL}${path}`;
}

export function canonical(path: string) {
  return { canonical: siteUrl(path) };
}

export const BRAND_SUFFIX = "Hot Since 86";
