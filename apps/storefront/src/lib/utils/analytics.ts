/**
 * Analytics — GA4 + Meta Pixel + GTM dataLayer + Google Ads conversions.
 *
 * All helpers are safe to call during SSR (no-op when `window` is undefined).
 * GA4 loaded via gtag.js, Meta Pixel via fbevents.js, GTM via gtm.js — all in __root.tsx.
 *
 * Events fire to:
 *   1. GA4 directly (gtag)
 *   2. Meta Pixel directly (fbq)
 *   3. GTM dataLayer (for AdScale, custom tags, etc.)
 *   4. Google Ads conversions (gtag "event" with send_to) when VITE_GOOGLE_ADS_ID
 *      and the relevant conversion label are configured.
 *
 * Signup/login events also push SHA-256-hashed user_data for Google Ads
 * Enhanced Conversions and attach stored ad attribution (gclid/utm) so the
 * conversion closes the loop with the original click.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 *  HEALTHCARE / PHARMA POLICY — DRUG-IDENTIFYING DATA IS SUPPRESSED FROM
 *  AD-NETWORK PAYLOADS
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * We are a licensed online pharmacy. Every product on this site is a medical
 * product. Sending drug names / SKUs / specific item IDs to ad networks —
 * even for OTC products — can violate:
 *
 *   - Google Ads Healthcare & Medicines policy (personalised advertising
 *     using health-inferred signals is prohibited)
 *   - Meta (Facebook) Personal Health and Appearance policy (custom and
 *     lookalike audiences may not be built from drug-specific behaviour)
 *   - India DPDP Act 2023 (health data is "sensitive personal data" with
 *     restricted processing)
 *
 * Concrete risks if drug-level data leaks to ad networks:
 *   - Account suspension after policy review
 *   - LegitScript / regulator scrutiny
 *   - User-level inference of health conditions
 *
 * RULES IMPLEMENTED IN THIS FILE:
 *
 *   - Meta Pixel (`fbq`) receives ONLY aggregate value + currency + count.
 *     No `content_name`, no `content_ids`, no `search_string`. The Pixel can
 *     still optimise its algorithm on value but cannot infer specific drugs.
 *   - Google Ads conversions (`gtag('event','conversion',...)`) send only
 *     hashed PII via Enhanced Conversions + `value`/`transaction_id`.
 *   - GA4 (`gtag('event', ...)`) and dataLayer (`pushDataLayer`) DO receive
 *     full product detail because they feed our INTERNAL analytics. If a
 *     GTM tag forwards these to an ad network, that tag's payload must be
 *     redacted in GTM admin — not from here.
 *   - dataLayer pushes include `sensitive_data: true` for medical events
 *     so GTM tags can decide what to forward to which destination.
 *   - Search queries are NEVER sent to ad networks (only GA4 internally).
 *
 * If you add a new event handler in this file, default to:
 *   gtag()         → full data (internal analytics)
 *   pushDataLayer  → full data + `sensitive_data: true`
 *   fbq()          → value, currency, count — that's it
 *   Google Ads     → hashed PII via setEnhancedConversionsUserData
 */

import { Capacitor } from "@capacitor/core"
import { hashUserData, type UserDataInput } from "@/lib/utils/enhanced-conversions"
import { getAdAttribution } from "@/lib/utils/ad-attribution"

const GOOGLE_ADS_ID = import.meta.env.VITE_GOOGLE_ADS_ID as string | undefined

/** "android" | "ios" | "web" — included on every event for platform segmentation in GA4. */
function getPlatform(): string {
  return Capacitor.isNativePlatform() ? Capacitor.getPlatform() : "web"
}
const SIGNUP_CONVERSION_LABEL = import.meta.env.VITE_GOOGLE_ADS_SIGNUP_CONVERSION_LABEL as string | undefined
const LOGIN_CONVERSION_LABEL = import.meta.env.VITE_GOOGLE_ADS_LOGIN_CONVERSION_LABEL as string | undefined

/* ------------------------------------------------------------------ */
/*  Type shims                                                        */
/* ------------------------------------------------------------------ */

type GtagCommand = "event" | "config" | "set"

declare global {
  interface Window {
    gtag?: (command: GtagCommand, action: string, params?: Record<string, unknown>) => void
    dataLayer?: unknown[]
    fbq?: (...args: unknown[]) => void
  }
}

function gtag(command: GtagCommand, action: string, params?: Record<string, unknown>) {
  if (typeof window === "undefined" || !window.gtag) return
  const enriched = command === "event" ? { platform: getPlatform(), ...params } : params
  window.gtag(command, action, enriched)
}

function fbq(...args: unknown[]) {
  if (typeof window === "undefined" || !window.fbq) return
  window.fbq(...args)
}

function pushDataLayer(event: string, data?: Record<string, unknown>) {
  if (typeof window === "undefined") return
  window.dataLayer = window.dataLayer || []
  window.dataLayer.push({ event, platform: getPlatform(), ...data })
}

/**
 * Same as pushDataLayer but flags the event as containing healthcare-sensitive
 * data. GTM tags forwarding to ad networks MUST check `sensitive_data` and
 * strip drug-level fields (item_id, item_name, items[].*) before sending.
 *
 * In GTM admin, a single "Drug Data Redaction" lookup table variable can map
 * `sensitive_data == true → strip items[].item_id, item_name` for every ad
 * destination tag (Google Ads remarketing, Meta Pixel via GTM, etc.).
 */
function pushSensitiveDataLayer(event: string, data?: Record<string, unknown>) {
  if (typeof window === "undefined") return
  window.dataLayer = window.dataLayer || []
  window.dataLayer.push({ event, platform: getPlatform(), sensitive_data: true, ...data })
}

/* ------------------------------------------------------------------ */
/*  Shared item builder                                               */
/* ------------------------------------------------------------------ */

interface ProductLike {
  id: string
  title?: string | null
  handle?: string | null
  collection?: { title?: string | null; handle?: string | null } | null
  variants?: Array<{
    id?: string
    title?: string | null
    sku?: string | null
    calculated_price?: { calculated_amount?: number | null; currency_code?: string | null } | null
  }> | null
}

function buildItem(product: ProductLike, variantIndex = 0, quantity = 1) {
  const v = product.variants?.[variantIndex]
  return {
    item_id: product.id,
    item_name: product.title ?? "",
    item_variant: v?.title ?? undefined,
    item_category: product.collection?.title ?? undefined,
    price: v?.calculated_price?.calculated_amount ?? undefined,
    quantity,
  }
}

/* ------------------------------------------------------------------ */
/*  Ecommerce events                                                  */
/* ------------------------------------------------------------------ */

/** Product detail page viewed */
export function trackViewItem(product: ProductLike, currency = "INR") {
  const value = product.variants?.[0]?.calculated_price?.calculated_amount ?? 0
  const items = [buildItem(product)]

  // GA4 — full product detail (internal analytics)
  gtag("event", "view_item", { currency, value, items })
  // Meta Pixel — value + currency only. No content_ids / content_name so Meta
  // cannot build audiences inferring health conditions from drug-specific views.
  fbq("track", "ViewContent", { value, currency })
  // dataLayer — full data, but flagged sensitive so GTM tags redact for ad destinations
  pushSensitiveDataLayer("view_item", { currency, value, items })
}

/** Product list / category page viewed */
export function trackViewItemList(
  products: ProductLike[],
  listName: string,
  currency = "INR",
) {
  const items = products.slice(0, 20).map((p, i) => ({
    ...buildItem(p),
    index: i,
    item_list_name: listName,
  }))

  // GA4 — full data
  gtag("event", "view_item_list", { item_list_name: listName, currency, items })
  // Meta Pixel — suppressed. Even category listings can imply health intent
  // (e.g., "Diabetic Care", "Cardiac"). Not worth the policy risk for a list view.
  // dataLayer — full data, flagged sensitive
  pushSensitiveDataLayer("view_item_list", { item_list_name: listName, currency, items })
}

/** Item added to cart */
export function trackAddToCart(
  product: ProductLike,
  variantIndex: number,
  quantity: number,
  currency = "INR",
) {
  const item = buildItem(product, variantIndex, quantity)
  const value = (item.price ?? 0) * quantity

  // GA4 — full product detail
  gtag("event", "add_to_cart", { currency, value, items: [item] })
  // Meta Pixel — value + currency only (no drug name / SKU)
  fbq("track", "AddToCart", { value, currency })
  // dataLayer — full data, flagged sensitive
  pushSensitiveDataLayer("add_to_cart", { currency, value, items: [item] })
}

/** Item removed from cart */
export function trackRemoveFromCart(
  product: ProductLike,
  variantIndex: number,
  quantity: number,
  currency = "INR",
) {
  const item = buildItem(product, variantIndex, quantity)
  const value = (item.price ?? 0) * quantity

  gtag("event", "remove_from_cart", { currency, value, items: [item] })
  pushSensitiveDataLayer("remove_from_cart", { currency, value, items: [item] })
  // Meta Pixel has no remove_from_cart equivalent — and we wouldn't send drug data anyway
}

/** Checkout started */
export function trackBeginCheckout(
  items: Array<{ product: ProductLike; variantIndex: number; quantity: number }>,
  totalValue: number,
  currency = "INR",
) {
  const builtItems = items.map(({ product, variantIndex, quantity }) =>
    buildItem(product, variantIndex, quantity),
  )

  // GA4 — full product detail
  gtag("event", "begin_checkout", { currency, value: totalValue, items: builtItems })
  // Meta Pixel — value + currency + cart size only (no per-product detail)
  fbq("track", "InitiateCheckout", {
    value: totalValue,
    currency,
    num_items: items.length,
  })
  // dataLayer — full data, flagged sensitive
  pushSensitiveDataLayer("begin_checkout", { currency, value: totalValue, items: builtItems })
}

/** Order completed */
export function trackPurchase(
  orderId: string,
  totalValue: number,
  items: Array<{ item_id: string; item_name: string; price?: number; quantity: number }>,
  currency = "INR",
  tax = 0,
  shipping = 0,
) {
  const params = { transaction_id: orderId, currency, value: totalValue, tax, shipping, items }

  // GA4 — full transaction detail for revenue/product analytics
  gtag("event", "purchase", params)
  // Meta Pixel — minimum needed for purchase attribution (no drug data).
  // We pass transaction_id to dedupe with server-side Conversions API if added later.
  fbq("track", "Purchase", {
    value: totalValue,
    currency,
    num_items: items.length,
    eventID: orderId,
  })
  // dataLayer — full data, flagged sensitive
  pushSensitiveDataLayer("purchase", params)
}

/** Site search */
export function trackSearch(query: string, resultCount?: number) {
  // GA4 only — search queries on a pharmacy site reveal health intent and
  // must NEVER be sent to ad networks (e.g., "atorvastatin" → high cholesterol).
  gtag("event", "search", {
    search_term: query,
    ...(resultCount !== undefined ? { results_count: resultCount } : {}),
  })
  // Meta Pixel Search event suppressed — search_string would leak drug names.
  // dataLayer flagged sensitive so GTM tags must NOT forward search_term to ad destinations.
  pushSensitiveDataLayer("search", { search_term: query, results_count: resultCount })
}

/** Generic custom event */
export function trackEvent(name: string, params?: Record<string, unknown>) {
  gtag("event", name, params)
  pushDataLayer(name, params)
}

/* ------------------------------------------------------------------ */
/*  Auth events — signup / login                                      */
/* ------------------------------------------------------------------ */

export type AuthMethod = "email" | "phone-otp" | "email-otp"

interface AuthEventInput {
  method: AuthMethod
  userId?: string | null
  userData?: UserDataInput
}

function adAttributionPayload(): Record<string, string> {
  const attr = getAdAttribution()
  if (!attr) return {}
  const out: Record<string, string> = {}
  for (const [k, v] of Object.entries(attr)) {
    if (typeof v === "string") out[k] = v
  }
  return out
}

/**
 * Register the user_data payload for Google Ads Enhanced Conversions on the
 * current page. gtag stores this globally for subsequent conversion events.
 * No-op if Google Ads is not configured or user_data is empty.
 */
async function setEnhancedConversionsUserData(userData?: UserDataInput): Promise<void> {
  if (!GOOGLE_ADS_ID || !userData) return
  const hashed = await hashUserData(userData)
  if (Object.keys(hashed).length === 0) return
  gtag("set", "user_data", hashed as unknown as Record<string, unknown>)
}

function fireGoogleAdsConversion(conversionLabel: string | undefined, params: Record<string, unknown>): void {
  if (!GOOGLE_ADS_ID || !conversionLabel) return
  gtag("event", "conversion", {
    send_to: `${GOOGLE_ADS_ID}/${conversionLabel}`,
    ...params,
  })
}

/** New user registration — fires to GA4, Meta Pixel, dataLayer, and Google Ads. */
export async function trackSignup(input: AuthEventInput): Promise<void> {
  const { method, userId, userData } = input
  const attribution = adAttributionPayload()

  // GA4
  gtag("event", "sign_up", {
    method,
    ...(userId ? { user_id: userId } : {}),
    ...attribution,
  })

  // Meta Pixel — CompleteRegistration
  fbq("track", "CompleteRegistration", {
    registration_method: method,
  })

  // GTM dataLayer
  pushDataLayer("sign_up", {
    method,
    ...(userId ? { user_id: userId } : {}),
    ...attribution,
  })

  // Google Ads enhanced conversion + conversion event
  await setEnhancedConversionsUserData(userData)
  fireGoogleAdsConversion(SIGNUP_CONVERSION_LABEL, {
    event_callback: undefined,
  })
}

/** Returning user sign-in — fires to GA4, dataLayer, and (optionally) Google Ads. */
export async function trackLogin(input: AuthEventInput): Promise<void> {
  const { method, userId, userData } = input
  const attribution = adAttributionPayload()

  gtag("event", "login", {
    method,
    ...(userId ? { user_id: userId } : {}),
    ...attribution,
  })

  pushDataLayer("login", {
    method,
    ...(userId ? { user_id: userId } : {}),
    ...attribution,
  })

  await setEnhancedConversionsUserData(userData)
  fireGoogleAdsConversion(LOGIN_CONVERSION_LABEL, {})
}
