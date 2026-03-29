import type { SubscriberArgs, SubscriberConfig } from "@medusajs/framework"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import { ORDERS_MODULE } from "../modules/orders"
import { INVENTORY_BATCH_MODULE } from "../modules/inventoryBatch"
import { captureException } from "../lib/sentry"
import { createLogger } from "../lib/logger"

const logger = createLogger("subscriber:order-updated")

/**
 * Fires on any order update. Syncs the pharmaOrder extension status
 * and logs meaningful state changes for audit purposes.
 */
export default async function orderUpdatedHandler({
  event: { data },
  container,
}: SubscriberArgs<{ id: string }>) {
  const orderId = data.id
  if (!orderId) return

  try {
    const orderService = container.resolve(Modules.ORDER) as any
    const order = await orderService.retrieveOrder(orderId, {})

    const {
      status,
      fulfillment_status,
      payment_status,
      display_id,
    } = order

    logger.info(
      `Order ${display_id ?? orderId} updated — ` +
        `status: ${status}, fulfillment: ${fulfillment_status ?? "n/a"}, ` +
        `payment: ${payment_status ?? "n/a"}`
    )

    // Sync the pharmaOrder extension with the latest Medusa order status
    try {
      const pharmaOrderService = container.resolve(ORDERS_MODULE) as any
      const [extension] = await pharmaOrderService.listOrderExtensions(
        { order_id: orderId },
        { take: 1 }
      )

      if (!extension) return

      // Map fulfillment_status to pharma statuses
      const statusMap: Record<string, string> = {
        shipped: "dispatched",
        delivered: "delivered",
        canceled: "cancelled",
      }

      const newStatus = statusMap[fulfillment_status]
      if (newStatus && extension.status !== newStatus) {
        const prevStatus = extension.status
        await pharmaOrderService.updateOrderExtensions({
          id: extension.id,
          status: newStatus,
        })
        await pharmaOrderService.createOrderStateHistorys({
          order_id: orderId,
          from_status: prevStatus,
          to_status: newStatus,
          changed_by: "system:order-updated-subscriber",
          reason: `Medusa fulfillment_status → ${fulfillment_status}`,
        })
        logger.info(
          `Extension for ${orderId}: ${prevStatus} → ${newStatus}`
        )
      }
    } catch (err) {
      // pharmaOrder module may not be active
      logger.warn(`Extension sync failed for ${orderId}: ${(err as Error).message}`)
      captureException(err, { subscriber: "order-updated", orderId, step: "sync-extension" })
    }

    // ── Re-allocate batches for any new/updated items ──────────────
    try {
      const query = container.resolve(ContainerRegistrationKeys.QUERY)
      const batchService = container.resolve(INVENTORY_BATCH_MODULE) as any

      const { data: [fullOrder] } = await (query as any).graph({
        entity: "order",
        fields: ["id", "items.*"],
        filters: { id: orderId },
      })

      if (!fullOrder?.items?.length) throw new Error("No items")

      // Check existing deductions
      let deductions: any[] = []
      try {
        deductions = await batchService.listBatchDeductions(
          { order_id: orderId, deduction_type: "sale" },
          { take: null }
        )
      } catch { /* none yet */ }

      const allocatedByItem = new Map<string, number>()
      for (const d of deductions) {
        const prev = allocatedByItem.get(d.order_line_item_id) || 0
        allocatedByItem.set(d.order_line_item_id, prev + Number(d.quantity))
      }

      // Find items with unallocated quantity
      const unallocatedItems = fullOrder.items.filter((item: any) => {
        const allocated = allocatedByItem.get(item.id) || 0
        return item.variant_id && Number(item.quantity) > allocated
      })

      if (!unallocatedItems.length) {
        logger.info(`Order ${orderId}: all items fully allocated after update`)
      } else {
        const MIN_SHELF_LIFE_DAYS = Number(process.env.BATCH_MIN_SHELF_LIFE_DAYS ?? 60)
        const mslCutoff = new Date()
        mslCutoff.setHours(0, 0, 0, 0)
        mslCutoff.setDate(mslCutoff.getDate() + MIN_SHELF_LIFE_DAYS)
        const today = new Date()
        today.setHours(0, 0, 0, 0)

        let totalAllocated = 0

        for (const item of unallocatedItems) {
          const alreadyAllocated = allocatedByItem.get(item.id) || 0
          let remaining = Number(item.quantity) - alreadyAllocated

          const batches = await batchService.listBatches(
            { product_variant_id: item.variant_id, status: "active" },
            { take: null, order: { expiry_date: "ASC" } }
          )

          let eligible = (batches as any[]).filter((b: any) => {
            const exp = new Date(b.expiry_date)
            exp.setHours(0, 0, 0, 0)
            const avail = Number(b.available_quantity) - Number(b.reserved_quantity ?? 0)
            return exp >= mslCutoff && avail > 0
          })
          if (!eligible.length) {
            eligible = (batches as any[]).filter((b: any) => {
              const exp = new Date(b.expiry_date)
              exp.setHours(0, 0, 0, 0)
              const avail = Number(b.available_quantity) - Number(b.reserved_quantity ?? 0)
              return exp >= today && avail > 0
            })
          }

          for (const batch of eligible) {
            if (remaining <= 0) break
            const avail = Number(batch.available_quantity) - Number(batch.reserved_quantity ?? 0)
            if (avail <= 0) continue
            const allocQty = Math.min(remaining, avail)
            const newAvail = Number(batch.available_quantity) - allocQty

            await batchService.updateBatches({
              id: batch.id,
              available_quantity: newAvail,
              version: Number(batch.version ?? 0) + 1,
              ...(newAvail === 0 ? { status: "depleted" } : {}),
            })
            await batchService.createBatchDeductions({
              batch_id: batch.id,
              order_line_item_id: item.id,
              order_id: orderId,
              quantity: allocQty,
              deduction_type: "sale",
            })
            remaining -= allocQty
            totalAllocated += allocQty
          }
        }

        logger.info(
          `Order ${orderId} edit: allocated ${totalAllocated} additional units across ${unallocatedItems.length} item(s)`
        )
      }
    } catch (allocErr) {
      logger.warn(
        `Re-allocation after edit failed for ${orderId}: ${(allocErr as Error).message}`
      )
    }
  } catch (err) {
    logger.error(`Failed for order ${orderId}: ${(err as Error).message}`)
    captureException(err, { subscriber: "order-updated", orderId })
  }
}

export const config: SubscriberConfig = { event: "order.updated" }
