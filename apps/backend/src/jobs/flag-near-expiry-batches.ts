import { MedusaContainer } from "@medusajs/framework/types"

export default async function FlagNearExpiryBatchesJob(
  container: MedusaContainer
) {
  const logger = container.resolve("logger")
  const batchService = container.resolve("pharmaInventoryBatch") as any
  const notificationService = container.resolve("pharmaNotification") as any

  logger.info("[expiry-job] Starting near-expiry batch scan")

  const NEAR_EXPIRY_THRESHOLD_DAYS = 90
  const QUARANTINE_THRESHOLD_DAYS = 30

  let expiredCount = 0
  let nearExpiryCount = 0

  try {
    const activeBatches = await batchService.listBatches(
      { status: "active" },
      { take: null }
    )

    const now = new Date()

    for (const batch of activeBatches) {
      const expiryDate = new Date(batch.expiry_date)
      const daysUntilExpiry = Math.floor(
        (expiryDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
      )

      if (daysUntilExpiry <= 0) {
        // Already expired — quarantine immediately
        await batchService.updateBatches(batch.id, { status: "expired" })
        expiredCount++
        logger.warn(
          `[expiry-job] Batch ${batch.lot_number} EXPIRED — quarantined`
        )
        continue
      }

      if (daysUntilExpiry <= NEAR_EXPIRY_THRESHOLD_DAYS) {
        nearExpiryCount++

        // Too close to dispatch safely — quarantine
        if (daysUntilExpiry <= QUARANTINE_THRESHOLD_DAYS) {
          await batchService.updateBatches(batch.id, { status: "quarantine" })
        }

        logger.warn(
          `[expiry-job] Batch ${batch.lot_number} expires in ${daysUntilExpiry} days`
        )

        try {
          await notificationService.createInternalNotifications({
            user_id: "system",
            role_scope: "pharmacist",
            type: "batch_expiry",
            title: `Batch Expiring Soon — ${batch.lot_number}`,
            body: `Product ${batch.product_id} batch ${batch.lot_number} expires in ${daysUntilExpiry} days. Available qty: ${batch.available_quantity}.`,
            reference_type: "batch",
            reference_id: batch.id,
          })
        } catch (notifErr) {
          logger.error(
            `[expiry-job] Failed to create notification for batch ${batch.lot_number}: ${notifErr}`
          )
        }
      }
    }

    logger.info(
      `[expiry-job] Processed ${activeBatches.length} batches: ${expiredCount} expired, ${nearExpiryCount} near-expiry`
    )
  } catch (err) {
    logger.error(`[expiry-job] Job failed: ${err}`)
    throw err
  }
}

export const config = {
  name: "flag-expiry",
  schedule: "35 5 * * *", // was: 0 5 * * * — staggered to avoid pool exhaustion
}
