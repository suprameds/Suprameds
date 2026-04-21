export const SITE_URL =
  import.meta.env.VITE_SITE_URL || "https://supracyn.in"

/**
 * Hardcoded country code for the single-market (India) storefront.
 * Suprameds is legally India-only (CDSCO license, Schedule X restrictions),
 * so we avoid URL-prefixed multi-region routing. All region lookups use this.
 */
export const DEFAULT_COUNTRY_CODE = "in"
