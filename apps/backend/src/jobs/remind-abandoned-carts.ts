import { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import { sendPushToCustomerTopic } from "../lib/firebase-messaging"

export default async function RemindAbandonedCartsJob(container: MedusaContainer) {
  const logger = container.resolve("logger") as {
    info: (msg: string) => void
    warn: (msg: string) => void
    error: (msg: string) => void
  }
  logger.info("[job] Executing remind-carts")

  try {
    const query = container.resolve(ContainerRegistrationKeys.QUERY)
    const cartService = container.resolve(Modules.CART) as any

    const { data: carts } = await query.graph({
      entity: "cart",
      fields: ["id", "customer_id", "updated_at", "completed_at", "metadata", "items.id"],
      filters: { completed_at: null },
    })

    const twoHoursAgo = Date.now() - 2 * 60 * 60 * 1000

    for (const cart of (carts as any[]) ?? []) {
      if (!cart?.customer_id) continue
      if (!Array.isArray(cart.items) || cart.items.length === 0) continue

      const updatedAt = new Date(cart.updated_at).getTime()
      if (!Number.isFinite(updatedAt) || updatedAt > twoHoursAgo) continue

      const metadata = (cart.metadata ?? {}) as Record<string, unknown>
      if (metadata.abandoned_push_sent_at) continue

      const result = await sendPushToCustomerTopic(cart.customer_id, {
        title: "Items waiting in your cart",
        body: "Complete your order before your cart items go out of stock.",
        data: {
          type: "abandoned_cart",
          cart_id: cart.id,
          url: "/in/cart",
        },
      })

      if (!result.ok) {
        logger.warn(`[job] Abandoned cart push skipped for cart ${cart.id}: ${result.reason}`)
        continue
      }

      await cartService.updateCarts(cart.id, {
        metadata: {
          ...metadata,
          abandoned_push_sent_at: new Date().toISOString(),
        },
      })
    }
  } catch (err) {
    logger.error(`[job] remind-carts failed: ${(err as Error).message}`)
  }
}

export const config = {
  name: "remind-carts",
  schedule: "0 * * * *",
}
