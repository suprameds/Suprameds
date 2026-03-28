import type { SubscriberArgs, SubscriberConfig } from "@medusajs/framework"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { captureException } from "../lib/sentry"

const LOG_PREFIX = "[mrp-conflict]"

type MrpConflictPayload = {
  conflicts: Array<{
    product_id: string
    product_title: string
    current_selling_price_paise: number
    batch_mrp_paise: number
    message: string
  }>
  po_number: string
}

/**
 * Subscriber: batch.mrp_conflict
 *
 * Fires when newly received batches have MRP values that conflict with
 * the current storefront selling price. This creates an admin notification
 * so the pricing team can take immediate corrective action (DPCO compliance).
 */
export default async function batchMrpConflictHandler({
  event: { data },
  container,
}: SubscriberArgs<MrpConflictPayload>) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER) as any

  const { conflicts, po_number } = data
  if (!conflicts?.length) {
    return
  }

  // Log each conflict at WARN level for visibility in server logs
  logger.warn(
    `${LOG_PREFIX} ${conflicts.length} MRP conflict(s) detected on PO ${po_number}`
  )
  for (const conflict of conflicts) {
    logger.warn(
      `${LOG_PREFIX} "${conflict.product_title}" (${conflict.product_id}): ` +
        `selling ₹${(conflict.current_selling_price_paise / 100).toFixed(2)} > ` +
        `batch MRP ₹${(conflict.batch_mrp_paise / 100).toFixed(2)} — ${conflict.message}`
    )
  }

  // Build a human-readable summary for the internal notification
  const summaryLines = conflicts.map(
    (c) =>
      `• ${c.product_title}: selling ₹${(c.current_selling_price_paise / 100).toFixed(2)} ` +
      `exceeds batch MRP ₹${(c.batch_mrp_paise / 100).toFixed(2)}`
  )
  const notificationBody =
    `PO ${po_number} — ${conflicts.length} product(s) have selling prices ` +
    `above the incoming batch MRP. Prices must be corrected before dispatch.\n\n` +
    summaryLines.join("\n")

  // Create an internal admin notification via the pharmaNotification module
  try {
    const notificationService = container.resolve("pharmaNotification") as any

    await notificationService.createInternalNotifications({
      user_id: "system",
      role_scope: "admin",
      type: "mrp_conflict",
      title: "MRP Conflict — Price Review Required",
      body: notificationBody,
      reference_type: "purchase_order",
      reference_id: po_number,
    })

    logger.info(
      `${LOG_PREFIX} Internal notification created for PO ${po_number}`
    )
  } catch (notifErr: any) {
    // Notification module may not be configured — log and continue gracefully
    logger.warn(
      `${LOG_PREFIX} Failed to create internal notification for PO ${po_number}: ${notifErr?.message}. ` +
        `Conflicts were logged above.`
    )
    captureException(notifErr, { subscriber: "batch-mrp-conflict", poNumber: po_number })
  }
}

export const config: SubscriberConfig = { event: "batch.mrp_conflict" }
