import type { SubscriberArgs, SubscriberConfig } from "@medusajs/framework"
import { Modules } from "@medusajs/framework/utils"

type WishlistPriceAlertData = {
  wishlist_item_id: string
  customer_id: string
  product_id: string
  variant_id?: string | null
}

/**
 * Listens to `wishlist.price_alert` — emitted when a price drop past the
 * customer's threshold has been confirmed. Sends an email notification via
 * the Medusa notification module (Resend provider).
 */
export default async function wishlistPriceAlertHandler({
  event,
  container,
}: SubscriberArgs<WishlistPriceAlertData>) {
  const { customer_id, product_id, wishlist_item_id } = event.data

  const notificationService = container.resolve(Modules.NOTIFICATION) as any
  const logger = container.resolve("logger") as any

  try {
    await notificationService.createNotifications({
      to: customer_id,
      channel: "email",
      template: "wishlist-price-drop",
      data: {
        product_id,
        wishlist_item_id,
      },
    })

    logger.info(
      `[subscriber:wishlist-price-alert] Notification queued for customer ${customer_id}, product ${product_id}`
    )
  } catch (err: any) {
    // Notification failure must not break the flow
    logger.warn(
      `[subscriber:wishlist-price-alert] Failed to notify customer ${customer_id}: ${err.message}`
    )
  }
}

export const config: SubscriberConfig = {
  event: "wishlist.price_alert",
}
