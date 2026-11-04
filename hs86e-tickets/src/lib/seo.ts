<<<<<<< HEAD
﻿export const SITE_URL = (
=======
﻿/** Canonical site URL resolution for sitemap + metadata. */
export const SITE_URL = (
>>>>>>> c065eef5f3568d3698496bb24754df96c851a2b2
  process.env.NEXT_PUBLIC_APP_URL || "https://hs86eapp.netlify.app"
).replace(/\/+$/, "");

export function siteUrl(path: string): string {
  return `${SITE_URL}${path}`;
}

export function canonical(path: string) {
  return { canonical: siteUrl(path) };
}

export const BRAND_SUFFIX = "Hot Since 86";
