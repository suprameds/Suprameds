import type { SubscriberArgs, SubscriberConfig } from "@medusajs/framework"
import { Modules } from "@medusajs/framework/utils"
import { WISHLIST_MODULE } from "../modules/wishlist"
import { captureException } from "../lib/sentry"

/**
 * Reacts to product.updated events.
 * If any price-related fields changed, finds wishlist items with alert_enabled
 * for that product and emits a `wishlist.price_check` event for each.
 * The actual price comparison happens in the price_check handler or the
 * `wishlist-price-alert` subscriber after fetching the live price.
 */
export default async function productPriceChangedHandler({
  event,
  container,
}: SubscriberArgs<{ id: string; fields?: string[] }>) {
  const { id: productId, fields } = event.data

  // Only proceed if price-related fields were updated
  if (
    fields &&
    !fields.some(
      (f: string) => f.includes("price") || f.includes("variant")
    )
  ) {
    return
  }

  const wishlistService = container.resolve(WISHLIST_MODULE) as any
  const eventBus = container.resolve(Modules.EVENT_BUS) as any
  const logger = container.resolve("logger") as any

  const alertItems = await wishlistService.listWishlistItems({
    product_id: productId,
    alert_enabled: true,
  })

  if (!alertItems.length) return

  logger.info(
    `[subscriber:product-price-changed] Product ${productId} updated — checking ${alertItems.length} wishlist alert(s)`
  )

  for (const item of alertItems) {
    try {
      await eventBus.emit("wishlist.price_check", {
        wishlist_item_id: item.id,
        customer_id: item.customer_id,
        product_id: item.product_id,
        variant_id: item.variant_id,
        price_at_addition: item.price_at_addition,
        alert_threshold_pct: item.alert_threshold_pct,
      })
    } catch (err: any) {
      logger.warn(
        `[subscriber:product-price-changed] Failed to emit for item ${item.id}: ${err.message}`
      )
      captureException(err, { subscriber: "product-price-changed", productId, wishlistItemId: item.id })
    }
  }
}

export const config: SubscriberConfig = {
  event: "product.updated",
}
