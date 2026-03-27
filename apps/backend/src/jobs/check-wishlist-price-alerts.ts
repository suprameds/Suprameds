import { MedusaContainer } from "@medusajs/framework/types"
import { Modules } from "@medusajs/framework/utils"
import { WISHLIST_MODULE } from "../modules/wishlist"

/**
 * Daily job — checks all wishlist items with price alerts enabled.
 * For each qualifying item it emits a `wishlist.price_check` event,
 * letting the subscriber decide whether the price has actually dropped.
 * Skips items alerted within the last 24 hours to prevent duplicate sends.
 *
 * Schedule: 09:00 IST every day (03:30 UTC).
 */
export default async function checkWishlistPriceAlerts(
  container: MedusaContainer
) {
  const wishlistService = container.resolve(WISHLIST_MODULE) as any
  const eventBus = container.resolve(Modules.EVENT_BUS) as any
  const logger = container.resolve("logger") as any

  logger.info("[wishlist-alerts] Starting price-alert scan")

  const alertItems = await wishlistService.listWishlistItems({
    alert_enabled: true,
  })

  let emitted = 0
  let skipped = 0

  for (const item of alertItems) {
    try {
      // Skip if already alerted in the last 24 hours
      if (item.last_alert_sent_at) {
        const hoursSinceAlert =
          (Date.now() - new Date(item.last_alert_sent_at).getTime()) /
          (1000 * 60 * 60)
        if (hoursSinceAlert < 24) {
          skipped++
          continue
        }
      }

      // Skip items where we have no baseline price to compare against
      if (item.price_at_addition <= 0) {
        skipped++
        continue
      }

      await eventBus.emit("wishlist.price_check", {
        wishlist_item_id: item.id,
        customer_id: item.customer_id,
        product_id: item.product_id,
        variant_id: item.variant_id,
        price_at_addition: item.price_at_addition,
        alert_threshold_pct: item.alert_threshold_pct,
      })

      emitted++
    } catch (err: any) {
      logger.warn(
        `[wishlist-alerts] Failed for item ${item.id}: ${err.message}`
      )
    }
  }

  logger.info(
    `[wishlist-alerts] Done — ${alertItems.length} items scanned, ${emitted} events emitted, ${skipped} skipped`
  )
}

export const config = {
  name: "check-wishlist-price-alerts",
  schedule: "30 3 * * *", // 03:30 UTC = 09:00 IST
}
