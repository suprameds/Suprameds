/**
 * Analytics — GA4 + Meta Pixel + GTM dataLayer.
 *
 * All helpers are safe to call during SSR (no-op when `window` is undefined).
 * GA4 loaded via gtag.js, Meta Pixel via fbevents.js, GTM via gtm.js — all in __root.tsx.
 *
 * Events fire to:
 *   1. GA4 directly (gtag)
 *   2. Meta Pixel directly (fbq)
 *   3. GTM dataLayer (for AdScale, custom tags, etc.)
 */

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
  window.gtag(command, action, params)
}

function fbq(...args: unknown[]) {
  if (typeof window === "undefined" || !window.fbq) return
  window.fbq(...args)
}

function pushDataLayer(event: string, data?: Record<string, unknown>) {
  if (typeof window === "undefined") return
  window.dataLayer = window.dataLayer || []
  window.dataLayer.push({ event, ...data })
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

  gtag("event", "view_item", { currency, value, items })
  fbq("track", "ViewContent", {
    content_ids: [product.id],
    content_name: product.title ?? "",
    content_type: "product",
    value,
    currency,
  })
  pushDataLayer("view_item", { currency, value, items })
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

  gtag("event", "view_item_list", { item_list_name: listName, currency, items })
  fbq("track", "ViewContent", {
    content_ids: products.slice(0, 20).map((p) => p.id),
    content_type: "product_group",
    content_name: listName,
  })
  pushDataLayer("view_item_list", { item_list_name: listName, currency, items })
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

  gtag("event", "add_to_cart", { currency, value, items: [item] })
  fbq("track", "AddToCart", {
    content_ids: [product.id],
    content_name: product.title ?? "",
    content_type: "product",
    value,
    currency,
  })
  pushDataLayer("add_to_cart", { currency, value, items: [item] })
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
  pushDataLayer("remove_from_cart", { currency, value, items: [item] })
  // Meta Pixel has no remove_from_cart equivalent
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

  gtag("event", "begin_checkout", { currency, value: totalValue, items: builtItems })
  fbq("track", "InitiateCheckout", {
    content_ids: items.map(({ product }) => product.id),
    num_items: items.length,
    value: totalValue,
    currency,
  })
  pushDataLayer("begin_checkout", { currency, value: totalValue, items: builtItems })
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

  gtag("event", "purchase", params)
  fbq("track", "Purchase", {
    content_ids: items.map((i) => i.item_id),
    content_type: "product",
    num_items: items.length,
    value: totalValue,
    currency,
  })
  pushDataLayer("purchase", params)
}

/** Site search */
export function trackSearch(query: string, resultCount?: number) {
  gtag("event", "search", {
    search_term: query,
    ...(resultCount !== undefined ? { results_count: resultCount } : {}),
  })
  fbq("track", "Search", { search_string: query })
  pushDataLayer("search", { search_term: query, results_count: resultCount })
}

/** Generic custom event */
export function trackEvent(name: string, params?: Record<string, unknown>) {
  gtag("event", name, params)
  pushDataLayer(name, params)
}
