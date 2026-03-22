import { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { CRM_MODULE } from "../modules/crm"

const LOG_PREFIX = "[job:identify-reorders]"
const MIN_ORDERS_FOR_PATTERN = 3
const INTERVAL_TOLERANCE_DAYS = 7
const MIN_CONFIDENCE_SCORE = 40

/**
 * Daily job: scans customer order history to detect recurring purchase patterns.
 * If a customer has ordered the same product variant 3+ times with roughly
 * consistent intervals (±7 days), creates/updates a ChronicReorderPattern.
 */
export default async function IdentifyChronicReordersJob(container: MedusaContainer) {
  const logger = container.resolve("logger") as any
  const query = container.resolve(ContainerRegistrationKeys.QUERY) as any
  const crmService = container.resolve(CRM_MODULE) as any

  logger.info(`${LOG_PREFIX} Starting chronic reorder pattern detection`)

  let patternsCreated = 0
  let patternsUpdated = 0

  try {
    // Fetch all orders with line items
    const { data: orders } = await query.graph({
      entity: "order",
      fields: ["id", "customer_id", "items.*", "created_at"],
      filters: { status: { $ne: "canceled" } },
    })

    if (!orders?.length) {
      logger.info(`${LOG_PREFIX} No orders found — skipping`)
      return
    }

    // Group by customer_id → variant_id → purchase dates
    const customerVariantHistory = new Map<string, Map<string, Date[]>>()

    for (const order of orders) {
      if (!order.customer_id) continue

      let variantMap = customerVariantHistory.get(order.customer_id)
      if (!variantMap) {
        variantMap = new Map()
        customerVariantHistory.set(order.customer_id, variantMap)
      }

      for (const item of order.items ?? []) {
        const variantId = item.variant_id
        if (!variantId) continue

        let dates = variantMap.get(variantId)
        if (!dates) {
          dates = []
          variantMap.set(variantId, dates)
        }
        dates.push(new Date(order.created_at))
      }
    }

    // Analyze patterns for each customer × variant combination
    for (const [customerId, variantMap] of customerVariantHistory) {
      for (const [variantId, dates] of variantMap) {
        if (dates.length < MIN_ORDERS_FOR_PATTERN) continue

        // Sort chronologically
        dates.sort((a, b) => a.getTime() - b.getTime())

        // Calculate intervals between consecutive orders (in days)
        const intervals: number[] = []
        for (let i = 1; i < dates.length; i++) {
          const diffMs = dates[i].getTime() - dates[i - 1].getTime()
          intervals.push(Math.round(diffMs / (1000 * 60 * 60 * 24)))
        }

        const avgInterval = Math.round(intervals.reduce((s, v) => s + v, 0) / intervals.length)

        // Check consistency: all intervals within ±tolerance of average
        const withinTolerance = intervals.filter(
          (d) => Math.abs(d - avgInterval) <= INTERVAL_TOLERANCE_DAYS
        )
        const confidenceScore = Math.round((withinTolerance.length / intervals.length) * 100)

        if (confidenceScore < MIN_CONFIDENCE_SCORE) continue

        const lastPurchased = dates[dates.length - 1]
        const nextExpected = new Date(lastPurchased.getTime() + avgInterval * 24 * 60 * 60 * 1000)

        // Check if pattern already exists for this customer + variant
        const [existing] = await crmService.listChronicReorderPatterns(
          { customer_id: customerId, variant_id: variantId },
          { take: 1 }
        )

        if (existing) {
          await crmService.updateChronicReorderPatterns(existing.id, {
            average_days_between_orders: avgInterval,
            last_purchased_at: lastPurchased,
            next_expected_at: nextExpected,
            confidence_score: confidenceScore,
            is_active: true,
          })
          patternsUpdated++
        } else {
          await crmService.createChronicReorderPatterns({
            customer_id: customerId,
            variant_id: variantId,
            average_days_between_orders: avgInterval,
            last_purchased_at: lastPurchased,
            next_expected_at: nextExpected,
            confidence_score: confidenceScore,
            is_active: true,
            detected_at: new Date(),
          })
          patternsCreated++
        }
      }
    }

    logger.info(
      `${LOG_PREFIX} Completed: ${patternsCreated} new patterns, ${patternsUpdated} updated`
    )
  } catch (err) {
    logger.error(`${LOG_PREFIX} Job failed: ${err}`)
    throw err
  }
}

export const config = {
  name: "identify-reorders",
  schedule: "0 3 * * *", // Daily at 3:00 AM IST
}
