import type { SubscriberArgs, SubscriberConfig } from "@medusajs/framework"
import { INVENTORY_BATCH_MODULE } from "../modules/inventoryBatch"
import { NOTIFICATION_MODULE } from "../modules/notification"

const LOG_PREFIX = "[subscriber:low-stock]"

/**
 * Default threshold — can be overridden by env var LOW_STOCK_THRESHOLD.
 * Alert fires when total active stock for a product variant drops below this.
 */
const LOW_STOCK_THRESHOLD = Number(process.env.LOW_STOCK_THRESHOLD) || 50

/**
 * De-duplication window in milliseconds (24 hours).
 * Prevents spamming the same low-stock alert repeatedly.
 */
const DEDUP_WINDOW_MS = 24 * 60 * 60 * 1000

/**
 * In-memory de-duplication map: variant_id → last alert timestamp.
 * Persists across event firings within the same server process.
 * Acceptable trade-off: after a restart, one duplicate alert may fire.
 */
const recentAlerts = new Map<string, number>()

type InventoryUpdateData = {
  product_variant_id?: string
  variant_id?: string
  product_id?: string
  batch_id?: string
}

/**
 * Subscriber: inventory.low_stock
 *
 * Fires when inventory changes (deductions, adjustments, etc.) push stock
 * below the configured threshold. Creates an internal notification for the
 * warehouse/pharmacist team.
 */
export default async function handler({
  event: { data },
  container,
}: SubscriberArgs<InventoryUpdateData>) {
  const logger = container.resolve("logger") as any
  const variantId = data.product_variant_id || data.variant_id

  if (!variantId) {
    logger.warn(`${LOG_PREFIX} Event received without variant ID — skipping`)
    return
  }

  // Check de-duplication window
  const lastAlert = recentAlerts.get(variantId)
  if (lastAlert && Date.now() - lastAlert < DEDUP_WINDOW_MS) {
    logger.debug(
      `${LOG_PREFIX} Duplicate alert suppressed for variant ${variantId} ` +
        `(last alert ${Math.round((Date.now() - lastAlert) / 60_000)}m ago)`
    )
    return
  }

  try {
    const batchService = container.resolve(INVENTORY_BATCH_MODULE) as any
    const notificationService = container.resolve(NOTIFICATION_MODULE) as any

    // Sum available quantities across all active batches for this variant
    const activeBatches = await batchService.listBatches(
      { product_variant_id: variantId, status: "active" },
      { take: null }
    )

    const totalStock = activeBatches.reduce(
      (sum: number, b: any) => sum + Number(b.available_quantity),
      0
    )

    if (totalStock >= LOW_STOCK_THRESHOLD) {
      return // Stock is fine
    }

    logger.warn(
      `${LOG_PREFIX} Low stock detected for variant ${variantId}: ` +
        `${totalStock} units (threshold: ${LOW_STOCK_THRESHOLD})`
    )

    // Record alert timestamp for de-duplication
    recentAlerts.set(variantId, Date.now())

    // Resolve product ID from the batch data or the first batch found
    const productId =
      data.product_id ||
      (activeBatches.length > 0 ? activeBatches[0].product_id : "unknown")

    const notificationType = totalStock === 0 ? "out_of_stock" : "low_stock"
    const title =
      totalStock === 0
        ? `OUT OF STOCK — Variant ${variantId}`
        : `Low Stock Alert — Variant ${variantId}`

    await notificationService.createInternalNotifications({
      user_id: "system",
      role_scope: "warehouse",
      type: notificationType,
      title,
      body:
        `Product ${productId}, variant ${variantId} has ${totalStock} units remaining ` +
        `(threshold: ${LOW_STOCK_THRESHOLD}). ` +
        `${activeBatches.length} active batch(es).`,
      reference_type: "product_variant",
      reference_id: variantId,
    })

    logger.info(
      `${LOG_PREFIX} ${notificationType} notification created for variant ${variantId}`
    )
  } catch (err: any) {
    logger.error(`${LOG_PREFIX} Failed to process low stock event: ${err.message}`)
  }
}

export const config: SubscriberConfig = { event: "inventory.low_stock" }
