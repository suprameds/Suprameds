import { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import { sendPushToCustomerTopic } from "../lib/firebase-messaging"
import { PHARMA_MODULE } from "../modules/pharma"

// Maximum push reminders per cart before we stop nudging
const MAX_REMINDERS_PER_CART = 2

// Cart is "abandoned" if last updated between 2 and 48 hours ago
const MIN_IDLE_MS = 2 * 60 * 60 * 1000 // 2 hours
const MAX_IDLE_MS = 48 * 60 * 60 * 1000 // 48 hours

/**
 * RemindAbandonedCartsJob — sends push notifications for abandoned carts.
 *
 * Rx compliance rules (Drugs & Cosmetics Act / CDSCO):
 *   - Rx-only carts (all items are H/H1): NO promotional reminder at all
 *     (cannot advertise prescription drugs to patients)
 *   - Mixed carts (Rx + OTC): generic "Complete your order" without
 *     naming or referencing the Rx products
 *   - OTC-only carts: standard "Your cart is waiting!" with product nudge
 */
export default async function RemindAbandonedCartsJob(container: MedusaContainer) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER) as any

  const hasFirebase = Boolean(
    process.env.FIREBASE_PROJECT_ID &&
    process.env.FIREBASE_CLIENT_EMAIL &&
    process.env.FIREBASE_PRIVATE_KEY
  )
  if (!hasFirebase) {
    logger.info("[job:remind-carts] Firebase not configured — skipping abandoned cart reminders")
    return
  }

  logger.info("[job:remind-carts] Starting abandoned cart reminder run")

  try {
    const query = container.resolve(ContainerRegistrationKeys.QUERY)
    const cartService = container.resolve(Modules.CART) as any
    const pharmaService = container.resolve(PHARMA_MODULE) as any

    // Fetch incomplete carts with items and product references
    const { data: carts } = await query.graph({
      entity: "cart",
      fields: [
        "id",
        "customer_id",
        "updated_at",
        "completed_at",
        "metadata",
        "items.id",
        "items.product_id",
        "items.title",
      ],
      filters: { completed_at: null },
    }) as any

    const now = Date.now()
    let sentCount = 0
    let skippedRx = 0
    let skippedMaxReminders = 0

    for (const cart of (carts as any[]) ?? []) {
      if (!cart?.customer_id) continue
      if (!Array.isArray(cart.items) || cart.items.length === 0) continue

      // ── Time window check ───────────────────────────────────────
      const updatedAt = new Date(cart.updated_at).getTime()
      if (!Number.isFinite(updatedAt)) continue

      const idleMs = now - updatedAt
      if (idleMs < MIN_IDLE_MS || idleMs > MAX_IDLE_MS) continue

      // ── Reminder limit check ────────────────────────────────────
      const metadata = (cart.metadata ?? {}) as Record<string, unknown>
      const reminderCount = Number(metadata.abandoned_reminder_count ?? 0)
      if (reminderCount >= MAX_REMINDERS_PER_CART) {
        skippedMaxReminders++
        continue
      }

      // ── Classify cart items by drug schedule ────────────────────
      const productIds: string[] = Array.from(
        new Set(
          (cart.items as any[]).map((i) => String(i.product_id)).filter(Boolean)
        )
      )

      let hasRx = false
      let hasOtc = false

      if (productIds.length > 0) {
        const drugs = await pharmaService.listDrugProducts(
          { product_id: productIds },
          {}
        )

        const drugScheduleMap = new Map<string, string>()
        for (const drug of drugs as any[]) {
          drugScheduleMap.set(drug.product_id, drug.schedule)
        }

        for (const productId of productIds) {
          const schedule = drugScheduleMap.get(productId) ?? "OTC"
          if (schedule === "H" || schedule === "H1") {
            hasRx = true
          } else {
            hasOtc = true
          }
        }
      } else {
        // No product_ids — treat as OTC
        hasOtc = true
      }

      // ── Rx-only cart: DO NOT send promotional reminder ──────────
      if (hasRx && !hasOtc) {
        skippedRx++
        logger.info(
          `[job:remind-carts] Skipping cart ${cart.id} — all Rx items, promotional reminder prohibited`
        )
        continue
      }

      // ── Build message based on cart composition ─────────────────
      let title: string
      let body: string

      if (hasRx && hasOtc) {
        // Mixed cart: generic message, no product names (cannot advertise Rx)
        title = "Complete your order"
        body = "You have items waiting in your cart. Complete your order before they go out of stock."
      } else {
        // OTC-only cart: friendly product-aware nudge
        title = "Your cart is waiting!"
        body = "Complete your order before your cart items go out of stock."
      }

      // ── Send push notification ──────────────────────────────────
      const result = await sendPushToCustomerTopic(cart.customer_id, {
        title,
        body,
        data: {
          type: "abandoned_cart",
          cart_id: cart.id,
          url: "/in/cart",
        },
      })

      if (!result.ok) {
        logger.warn(
          `[job:remind-carts] Push skipped for cart ${cart.id}: ${result.reason}`
        )
        continue
      }

      // ── Track reminder in cart metadata ─────────────────────────
      const newCount = reminderCount + 1
      await cartService.updateCarts(cart.id, {
        metadata: {
          ...metadata,
          abandoned_reminder_count: newCount,
          abandoned_reminder_last_sent: new Date().toISOString(),
          abandoned_reminder_type: hasRx ? "mixed_generic" : "otc_standard",
        },
      })

      sentCount++
      logger.info(
        `[job:remind-carts] Sent reminder #${newCount} for cart ${cart.id} ` +
          `(${hasRx ? "mixed" : "otc"}, customer: ${cart.customer_id})`
      )
    }

    logger.info(
      `[job:remind-carts] Run complete — sent: ${sentCount}, ` +
        `skipped_rx: ${skippedRx}, skipped_max: ${skippedMaxReminders}`
    )
  } catch (err) {
    logger.error(`[job:remind-carts] Failed: ${(err as Error).message}`)
  }
}

export const config = {
  name: "remind-abandoned-carts",
  // Every 2 hours (was: 0 */2 * * * — staggered to avoid pool exhaustion)
  schedule: "23 */2 * * *",
}
