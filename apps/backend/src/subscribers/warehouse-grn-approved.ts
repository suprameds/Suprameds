import type { SubscriberArgs, SubscriberConfig } from "@medusajs/framework"
import { INVENTORY_BATCH_MODULE } from "../modules/inventoryBatch"
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
 * 1. Creates inventory batches for each received line item
 * 2. Updates the GRN record status to 'approved'
 * 3. Sends an internal notification confirming stock is available
 */
export default async function handler({
  event: { data },
  container,
}: SubscriberArgs<GrnApprovedData>) {
  const logger = container.resolve("logger") as any
  logger.info(`${LOG_PREFIX} GRN ${data.grn_number} approved by ${data.approved_by}`)

  const batchService = container.resolve(INVENTORY_BATCH_MODULE) as any
  const warehouseService = container.resolve(WAREHOUSE_MODULE) as any
  const notificationService = container.resolve(NOTIFICATION_MODULE) as any

  const createdBatches: string[] = []
  let totalQuantity = 0

  // 1. Create inventory batches from GRN line items
  for (const item of data.items) {
    try {
      const batch = await batchService.createBatches({
        product_variant_id: item.product_variant_id,
        product_id: item.product_id,
        lot_number: item.lot_number,
        expiry_date: item.expiry_date,
        manufactured_on: item.manufactured_on || null,
        received_quantity: item.quantity,
        available_quantity: item.quantity,
        reserved_quantity: 0,
        batch_mrp_paise: item.batch_mrp_paise ?? null,
        purchase_price_paise: item.purchase_price_paise ?? null,
        grn_number: data.grn_number,
        supplier_name: data.supplier_id,
        received_on: new Date().toISOString(),
        status: "active",
      })

      createdBatches.push(batch.id)
      totalQuantity += item.quantity

      logger.info(
        `${LOG_PREFIX} Created batch ${batch.id} for lot ${item.lot_number} ` +
          `(qty: ${item.quantity}, exp: ${item.expiry_date})`
      )
    } catch (err: any) {
      logger.error(
        `${LOG_PREFIX} Failed to create batch for lot ${item.lot_number}: ${err.message}`
      )
      captureException(err, { subscriber: "warehouse-grn-approved", grnId: data.grn_id, lotNumber: item.lot_number, step: "create-batch" })
    }
  }

  // 2. Update GRN record status
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
        `${createdBatches.length} batch(es) created with ${totalQuantity} total units. ` +
        `Stock is now available for FEFO allocation.`,
      reference_type: "grn",
      reference_id: data.grn_id,
    })
  } catch (err: any) {
    logger.error(`${LOG_PREFIX} Notification failed: ${err.message}`)
    captureException(err, { subscriber: "warehouse-grn-approved", grnId: data.grn_id, step: "send-notification" })
  }

  logger.info(
    `${LOG_PREFIX} Completed: ${createdBatches.length} batches created, ` +
      `${totalQuantity} total units received`
  )
}

export const config: SubscriberConfig = { event: "warehouse.grn_approved" }
