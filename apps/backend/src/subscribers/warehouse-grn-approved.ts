import type { SubscriberArgs, SubscriberConfig } from "@medusajs/framework"
import { WAREHOUSE_MODULE } from "../modules/warehouse"
import { NOTIFICATION_MODULE } from "../modules/notification"
import { captureException } from "../lib/sentry"

const LOG_PREFIX = "[subscriber:grn-approved]"

type GrnApprovedData = {
  grn_id: string
  grn_number: string
  supplier_id: string
  approved_by: string
  items: Array<{
    product_id: string
    product_variant_id: string
    lot_number: string
    expiry_date: string
    quantity: number
    batch_mrp_paise?: number
    purchase_price_paise?: number
    manufactured_on?: string
  }>
}

/**
 * Subscriber: warehouse.grn_approved
 *
 * After a GRN (Goods Receipt Note) is approved by QC, this subscriber:
 * 1. Updates the GRN record status to 'approved'
 * 2. Sends an internal notification confirming stock is available
 *
 * NOTE: Batch creation is handled by ApproveGrnWorkflow's createBatchesFromGrnStep.
 * This subscriber must NOT create batches to avoid duplicates.
 */
export default async function warehouseGrnApprovedHandler({
  event: { data },
  container,
}: SubscriberArgs<GrnApprovedData>) {
  const logger = container.resolve("logger") as any
  logger.info(`${LOG_PREFIX} GRN ${data.grn_number} approved by ${data.approved_by}`)

  const warehouseService = container.resolve(WAREHOUSE_MODULE) as any
  const notificationService = container.resolve(NOTIFICATION_MODULE) as any

  const totalQuantity = data.items.reduce((sum, item) => sum + item.quantity, 0)

  // 1. Update GRN record status
  try {
    const [grnRecord] = await warehouseService.listGrnRecords(
      { id: data.grn_id },
      { take: 1 }
    )

    if (grnRecord) {
      await warehouseService.updateGrnRecords(grnRecord.id, {
        status: "approved",
        qc_approved_by: data.approved_by,
        qc_approved_at: new Date().toISOString(),
      })
      logger.info(`${LOG_PREFIX} GRN record ${data.grn_id} marked as approved`)
    }
  } catch (err: any) {
    logger.error(`${LOG_PREFIX} Failed to update GRN record: ${err.message}`)
    captureException(err, { subscriber: "warehouse-grn-approved", grnId: data.grn_id, step: "update-grn-record" })
  }

  // 3. Send internal notification
  try {
    await notificationService.createInternalNotifications({
      user_id: data.approved_by,
      role_scope: "warehouse",
      type: "dispatch_pending",
      title: `GRN Approved — ${data.grn_number}`,
      body:
        `${data.items.length} batch(es) received with ${totalQuantity} total units. ` +
        `Stock is now available for FEFO allocation.`,
      reference_type: "grn",
      reference_id: data.grn_id,
    })
  } catch (err: any) {
    logger.error(`${LOG_PREFIX} Notification failed: ${err.message}`)
    captureException(err, { subscriber: "warehouse-grn-approved", grnId: data.grn_id, step: "send-notification" })
  }

  logger.info(
    `${LOG_PREFIX} Completed: GRN record updated, notification sent ` +
      `(${data.items.length} items, ${totalQuantity} total units)`
  )
}

export const config: SubscriberConfig = { event: "warehouse.grn_approved" }
