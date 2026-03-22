import { MedusaContainer } from "@medusajs/framework/types"
import { Modules } from "@medusajs/framework/utils"
import { ORDERS_MODULE } from "../modules/orders"

const LOG_PREFIX = "[job:release-guest-sessions]"
const EXPIRY_HOURS = 48

/**
 * Hourly job: deletes guest sessions older than 48 hours
 * and cleans up their associated abandoned carts.
 */
export default async function ReleaseExpiredGuestSessionsJob(container: MedusaContainer) {
  const logger = container.resolve("logger") as any
  const orderService = container.resolve(ORDERS_MODULE) as any
  const cartService = container.resolve(Modules.CART) as any

  logger.info(`${LOG_PREFIX} Starting expired guest session cleanup`)

  let sessionsDeleted = 0
  let cartsDeleted = 0

  try {
    const now = new Date()

    // Fetch all guest sessions
    const sessions = await orderService.listGuestSessions({}, { take: null })

    const expiredSessions = sessions.filter((s: any) => {
      const expiresAt = new Date(s.expires_at)
      return expiresAt < now
    })

    if (!expiredSessions.length) {
      logger.info(`${LOG_PREFIX} No expired sessions found — skipping`)
      return
    }

    logger.info(`${LOG_PREFIX} Found ${expiredSessions.length} expired session(s)`)

    for (const session of expiredSessions) {
      try {
        // Clean up the associated cart if it exists and hasn't been completed
        if (session.cart_id && !session.converted_to) {
          try {
            const cart = await cartService.retrieveCart(session.cart_id)
            if (cart && !cart.completed_at) {
              await cartService.deleteCarts(session.cart_id)
              cartsDeleted++
              logger.info(`${LOG_PREFIX} Deleted abandoned cart ${session.cart_id}`)
            }
          } catch {
            // Cart may already be deleted or completed — safe to ignore
          }
        }

        // Delete the guest session
        await orderService.deleteGuestSessions(session.id)
        sessionsDeleted++
      } catch (err) {
        logger.error(
          `${LOG_PREFIX} Failed to clean up session ${session.id}: ${(err as Error).message}`
        )
      }
    }

    logger.info(
      `${LOG_PREFIX} Completed: ${sessionsDeleted} sessions deleted, ${cartsDeleted} carts cleaned up`
    )
  } catch (err) {
    logger.error(`${LOG_PREFIX} Job failed: ${err}`)
    throw err
  }
}

export const config = {
  name: "release-guest-sessions",
  schedule: "0 * * * *", // Every hour
}
