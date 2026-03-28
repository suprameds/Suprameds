/**
 * Google Analytics 4 — Enhanced Ecommerce event helpers.
 *
 * All helpers are safe to call during SSR (they no-op when `window` is undefined).
 * GA4 must be loaded via the gtag.js snippet in __root.tsx head scripts.
 */

/* ------------------------------------------------------------------ */
/*  Gtag type shim                                                    */
/* ------------------------------------------------------------------ */

type GtagCommand = "event" | "config" | "set"

declare global {
  interface Window {
    gtag?: (command: GtagCommand, action: string, params?: Record<string, unknown>) => void
    dataLayer?: unknown[]
  }
}

function gtag(command: GtagCommand, action: string, params?: Record<string, unknown>) {
  if (typeof window === "undefined" || !window.gtag) return
  window.gtag(command, action, params)
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
  gtag("event", "view_item", {
    currency,
    value: product.variants?.[0]?.calculated_price?.calculated_amount ?? 0,
    items: [buildItem(product)],
  })
}

/** Product list / category page viewed */
export function trackViewItemList(
  products: ProductLike[],
  listName: string,
  currency = "INR",
) {
  gtag("event", "view_item_list", {
    item_list_name: listName,
    currency,
    items: products.slice(0, 20).map((p, i) => ({
      ...buildItem(p),
      index: i,
      item_list_name: listName,
    })),
  })
}

/** Item added to cart */
export function trackAddToCart(
  product: ProductLike,
  variantIndex: number,
  quantity: number,
  currency = "INR",
) {
  const item = buildItem(product, variantIndex, quantity)
  gtag("event", "add_to_cart", {
    currency,
    value: (item.price ?? 0) * quantity,
    items: [item],
  })
}

/** Item removed from cart */
export function trackRemoveFromCart(
  product: ProductLike,
  variantIndex: number,
  quantity: number,
  currency = "INR",
) {
  const item = buildItem(product, variantIndex, quantity)
  gtag("event", "remove_from_cart", {
    currency,
    value: (item.price ?? 0) * quantity,
    items: [item],
  })
}

/** Checkout started */
export function trackBeginCheckout(
  items: Array<{ product: ProductLike; variantIndex: number; quantity: number }>,
  totalValue: number,
  currency = "INR",
) {
  gtag("event", "begin_checkout", {
    currency,
    value: totalValue,
    items: items.map(({ product, variantIndex, quantity }) =>
      buildItem(product, variantIndex, quantity),
    ),
  })
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
  gtag("event", "purchase", {
    transaction_id: orderId,
    currency,
    value: totalValue,
    tax,
    shipping,
    items,
  })
}

/** Site search */
export function trackSearch(query: string, resultCount?: number) {
  gtag("event", "search", {
    search_term: query,
    ...(resultCount !== undefined ? { results_count: resultCount } : {}),
  })
}

/** Generic custom event */
export function trackEvent(name: string, params?: Record<string, unknown>) {
  gtag("event", name, params)
}
