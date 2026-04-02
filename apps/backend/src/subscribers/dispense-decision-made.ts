import type { SubscriberArgs, SubscriberConfig } from "@medusajs/framework"
import { Modules } from "@medusajs/framework/utils"
import { ORDERS_MODULE } from "../modules/orders"
import { NOTIFICATION_MODULE } from "../modules/notification"
import { INVENTORY_BATCH_MODULE } from "../modules/inventoryBatch"
import { captureException } from "../lib/sentry"
import { createLogger } from "../lib/logger"

const logger = createLogger("subscriber:dispense-decision-made")

type DispenseDecisionData = {
  order_id: string
  decision: "approved" | "rejected" | "modified"
  pharmacist_id?: string
  reason?: string
}

/**
 * Fires when a pharmacist makes a dispensing decision on an Rx order.
 * Updates the pharmaOrder extension and notifies the warehouse team.
 */
export default async function dispenseDecisionHandler({
  event: { data },
  container,
}: SubscriberArgs<DispenseDecisionData>) {
  const { order_id, decision, pharmacist_id, reason } = data
  if (!order_id) return

  logger.info(`Order ${order_id}: decision=${decision} by ${pharmacist_id ?? "unknown"}`)

  try {
    // Update pharmaOrder extension status based on decision
    const pharmaOrderService = container.resolve(ORDERS_MODULE) as any
    const [extension] = await pharmaOrderService.listOrderExtensions(
      { order_id },
      { take: 1 }
    )

    if (!extension) {
      logger.warn(`No OrderExtension found for ${order_id}`)
      return
    }

    const statusMap: Record<string, string> = {
      approved: "ready_for_dispatch",
      rejected: "dispense_rejected",
      modified: "pending_customer_confirmation",
    }

    const newStatus = statusMap[decision] || extension.status
    const prevStatus = extension.status

    if (prevStatus !== newStatus) {
      await pharmaOrderService.updateOrderExtensions({
        id: extension.id,
        status: newStatus,
        dispensed_by: pharmacist_id,
      })
      await pharmaOrderService.createOrderStateHistorys({
        order_id,
        from_status: prevStatus,
        to_status: newStatus,
        changed_by: pharmacist_id ?? "system:dispense-decision",
        reason: reason ?? `Dispense ${decision}`,
      })
      logger.info(`${order_id}: ${prevStatus} → ${newStatus}`)
    }

    // On approval: auto-allocate batches (FEFO) + notify warehouse
    if (decision === "approved") {
      // ── FEFO batch allocation ──
      try {
        const orderService = container.resolve(Modules.ORDER) as any
        const order = await orderService.retrieveOrder(order_id, { relations: ["items"] })
        const batchService = container.resolve(INVENTORY_BATCH_MODULE) as any

        const MIN_SHELF_LIFE_DAYS = Number(process.env.BATCH_MIN_SHELF_LIFE_DAYS ?? 60)
        const mslCutoff = new Date()
        mslCutoff.setHours(0, 0, 0, 0)
        mslCutoff.setDate(mslCutoff.getDate() + MIN_SHELF_LIFE_DAYS)
        const today = new Date()
        today.setHours(0, 0, 0, 0)

        let allAllocated = true

        for (const item of order.items ?? []) {
          const variantId = item.variant_id
          if (!variantId) continue

          // Check if already allocated
          const existingDeductions = await batchService.listBatchDeductions({
            order_line_item_id: item.id,
            deduction_type: "sale",
          })
          if (existingDeductions?.length > 0) continue

          // FEFO: get batches sorted by expiry
          const batches = await batchService.listBatches(
            { product_variant_id: variantId, status: "active" },
            { take: null, order: { expiry_date: "ASC" } }
          )

          // Tier 1: batches with enough shelf life
          let eligible = (batches as any[]).filter((b: any) => {
            const exp = new Date(b.expiry_date); exp.setHours(0, 0, 0, 0)
            return exp >= mslCutoff && (Number(b.available_quantity) - Number(b.reserved_quantity ?? 0)) > 0
          })
          // Tier 2: any non-expired batch
          if (!eligible.length) {
            eligible = (batches as any[]).filter((b: any) => {
              const exp = new Date(b.expiry_date); exp.setHours(0, 0, 0, 0)
              return exp >= today && (Number(b.available_quantity) - Number(b.reserved_quantity ?? 0)) > 0
            })
          }

          let remaining = Number(item.quantity)
          for (const batch of eligible) {
            if (remaining <= 0) break
            const avail = Number(batch.available_quantity) - Number(batch.reserved_quantity ?? 0)
            if (avail <= 0) continue
            const allocQty = Math.min(remaining, avail)

            await batchService.updateBatches({
              id: batch.id,
              available_quantity: Number(batch.available_quantity) - allocQty,
              version: Number(batch.version ?? 0) + 1,
              ...(Number(batch.available_quantity) - allocQty === 0 ? { status: "depleted" } : {}),
            })
            await batchService.createBatchDeductions({
              batch_id: batch.id,
              order_line_item_id: item.id,
              order_id: order_id,
              quantity: allocQty,
              deduction_type: "sale",
            })
            remaining -= allocQty
          }
          if (remaining > 0) allAllocated = false
        }

        logger.info(`${order_id}: FEFO allocation ${allAllocated ? "complete" : "partial — insufficient stock"}`)

        // Notify warehouse
        try {
          const notifService = container.resolve(NOTIFICATION_MODULE) as any
          await notifService.createInternalNotifications({
            user_id: pharmacist_id ?? "system",
            role_scope: "warehouse",
            type: "dispatch_pending",
            title: `Order #${order.display_id ?? order_id} — Ready for Dispatch`,
            body: `Pharmacist approved. Batches ${allAllocated ? "fully allocated" : "partially allocated"}.`,
            reference_type: "order",
            reference_id: order_id,
          })
        } catch (notifErr) {
          logger.warn(`Internal notification failed: ${(notifErr as Error).message}`)
        }
      } catch (err) {
        logger.warn(`FEFO allocation failed for ${order_id}: ${(err as Error).message}`)
        captureException(err, { subscriber: "dispense-decision-made", orderId: order_id, step: "fefo-allocation" })
      }
    }
  } catch (err) {
    logger.error(`Failed for order ${order_id}: ${(err as Error).message}`)
    captureException(err, { subscriber: "dispense-decision-made", orderId: order_id })
  }
}

export const config: SubscriberConfig = { event: "dispense.decision_made" }
