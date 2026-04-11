import { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { jobGuard } from "../lib/job-guard"
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
  const guard = jobGuard("identify-reorders")
  if (guard.shouldSkip()) return

  const logger = container.resolve("logger") as any
  const query = container.resolve(ContainerRegistrationKeys.QUERY) as any
  const crmService = container.resolve(CRM_MODULE) as any

  logger.info(`${LOG_PREFIX} Starting chronic reorder pattern detection`)

  let patternsCreated = 0
  let patternsUpdated = 0

  try {
    // Only scan orders from the last 12 months (older orders don't affect pattern detection)
    const twelveMonthsAgo = new Date()
    twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 12)

    const PAGE_SIZE = 5000
    const orders: any[] = []
    let offset = 0
    while (true) {
      const { data: page } = await query.graph({
        entity: "order",
        fields: ["id", "customer_id", "items.variant_id", "created_at"],
        filters: {
          status: { $ne: "canceled" },
          created_at: { $gte: twelveMonthsAgo.toISOString() },
        },
        pagination: { take: PAGE_SIZE, skip: offset },
      })
      if (!page?.length) break
      orders.push(...page)
      if (page.length < PAGE_SIZE) break
      offset += PAGE_SIZE
    }

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

    // Pre-fetch all existing patterns to avoid N+1 queries
    const existingPatterns = await crmService.listChronicReorderPatterns(
      {},
      { take: null }
    )
    const patternKey = (cid: string, vid: string) => `${cid}:${vid}`
    const patternMap = new Map<string, any>()
    for (const p of existingPatterns) {
      patternMap.set(patternKey(p.customer_id, p.variant_id), p)
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

        const existing = patternMap.get(patternKey(customerId, variantId))

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
    guard.success()
  } catch (err) {
    guard.failure(err)
    logger.error(`${LOG_PREFIX} Job failed: ${err}`)
    throw err
  }
}

export const config = {
  name: "identify-reorders",
  schedule: "20 3 * * *", // was: 0 3 * * * — staggered to avoid pool exhaustion
}
