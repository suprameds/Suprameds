import { MedusaContainer } from "@medusajs/framework/types"

const LOG_PREFIX = "[low-stock-job]"

/**
 * Configurable threshold: minimum stock quantity per product variant.
 * Variants below this trigger a low_stock notification; variants at 0 trigger out_of_stock.
 */
const LOW_STOCK_THRESHOLD = Number(process.env.LOW_STOCK_THRESHOLD) || 50

type VariantStockSummary = {
  product_variant_id: string
  product_id: string
  total_available: number
  batch_count: number
}

/**
 * Scheduled Job: check-low-stock
 *
 * Runs every 6 hours. Aggregates active batch quantities per product variant
 * and creates notifications for variants below the stock threshold.
 */
export default async function CheckLowStockJob(container: MedusaContainer) {
  const logger = container.resolve("logger") as any
  const batchService = container.resolve("pharmaInventoryBatch") as any
  const notificationService = container.resolve("pharmaNotification") as any

  logger.info(`${LOG_PREFIX} Starting low stock scan (threshold: ${LOW_STOCK_THRESHOLD})`)

  try {
    // Fetch all active batches in one query
    const activeBatches = await batchService.listBatches(
      { status: "active" },
      { take: null }
    )

    // Aggregate stock per product variant
    const variantMap = new Map<string, VariantStockSummary>()

    for (const batch of activeBatches) {
      const vid = batch.product_variant_id
      const existing = variantMap.get(vid)

      if (existing) {
        existing.total_available += Number(batch.available_quantity)
        existing.batch_count += 1
      } else {
        variantMap.set(vid, {
          product_variant_id: vid,
          product_id: batch.product_id,
          total_available: Number(batch.available_quantity),
          batch_count: 1,
        })
      }
    }

    let lowStockCount = 0
    let outOfStockCount = 0

    // Check each variant against the threshold
    for (const [variantId, summary] of variantMap) {
      if (summary.total_available >= LOW_STOCK_THRESHOLD) continue

      const isOutOfStock = summary.total_available === 0

      if (isOutOfStock) {
        outOfStockCount++
      } else {
        lowStockCount++
      }

      logger.warn(
        `${LOG_PREFIX} ${isOutOfStock ? "OUT OF STOCK" : "LOW STOCK"}: ` +
          `variant ${variantId} (product ${summary.product_id}) — ` +
          `${summary.total_available} units across ${summary.batch_count} batch(es)`
      )

      try {
        await notificationService.createInternalNotifications({
          user_id: "system",
          role_scope: "warehouse",
          type: isOutOfStock ? "out_of_stock" : "low_stock",
          title: isOutOfStock
            ? `OUT OF STOCK — ${variantId}`
            : `Low Stock — ${variantId}`,
          body:
            `Product ${summary.product_id}, variant ${variantId}: ` +
            `${summary.total_available} units remaining across ` +
            `${summary.batch_count} active batch(es). Threshold: ${LOW_STOCK_THRESHOLD}.`,
          reference_type: "product_variant",
          reference_id: variantId,
        })
      } catch (err: any) {
        logger.error(
          `${LOG_PREFIX} Failed to create notification for variant ${variantId}: ${err.message}`
        )
      }
    }

    // Also check for variants that have NO active batches at all
    // These won't appear in the active batch query, so we rely on the
    // out_of_stock notifications from previous runs or subscriber events.

    logger.info(
      `${LOG_PREFIX} Scan complete: ${variantMap.size} variants checked, ` +
        `${lowStockCount} low stock, ${outOfStockCount} out of stock`
    )
  } catch (err: any) {
    logger.error(`${LOG_PREFIX} Job failed: ${err.message}`)
    throw err
  }
}

export const config = {
  name: "check-low-stock",
  // Every 6 hours (was: 0 */6 * * * — staggered to avoid pool exhaustion)
  schedule: "33 */6 * * *",
}
