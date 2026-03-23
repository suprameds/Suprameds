import { MedusaContainer } from "@medusajs/framework/types"
import { Modules } from "@medusajs/framework/utils"
import { INVENTORY_BATCH_MODULE } from "../modules/inventoryBatch"
import { ORDERS_MODULE } from "../modules/orders"

const LOG = "[job:auto-allocate-fefo]"

/**
 * Runs every 5 minutes — allocates inventory to orders using FEFO
 * (First Expiry First Out). Processes orders in "payment_captured" status
 * that haven't been allocated yet.
 *
 * FEFO ensures shortest-shelf-life stock is dispatched first, reducing
 * wastage and complying with Indian pharmaceutical best practices.
 */
export default async function AutoAllocateFefoJob(container: MedusaContainer) {
  const logger = container.resolve("logger") as any
  logger.info(`${LOG} Starting`)

  try {
    const pharmaOrderService = container.resolve(ORDERS_MODULE) as any
    const batchService = container.resolve(INVENTORY_BATCH_MODULE) as any
    const orderService = container.resolve(Modules.ORDER) as any

    // Find orders ready for allocation (payment captured, not yet allocated)
    const pendingOrders = await pharmaOrderService.listOrderExtensions(
      { status: "payment_captured" },
      { take: 50 }
    )

    if (!pendingOrders?.length) {
      logger.info(`${LOG} No orders pending allocation`)
      return
    }

    let allocated = 0
    let failed = 0

    for (const ext of pendingOrders) {
      try {
        const order = await orderService.retrieveOrder(ext.order_id, {
          relations: ["items", "items.variant"],
        })

        if (!order?.items?.length) continue

        let allItemsAllocated = true

        for (const item of order.items) {
          const variantId = item.variant_id
          if (!variantId) continue

          // Get active batches sorted by earliest expiry (FEFO)
          const batches = await batchService.listBatches(
            {
              product_variant_id: variantId,
              status: "active",
            },
            {
              take: 20,
              order: { expiry_date: "ASC" },
            }
          )

          let remaining = item.quantity
          for (const batch of batches) {
            if (remaining <= 0) break

            const available = Number(batch.available_quantity)
            if (available <= 0) continue

            const allocateQty = Math.min(remaining, available)

            await batchService.updateBatches(batch.id, {
              available_quantity: available - allocateQty,
              reserved_quantity: Number(batch.reserved_quantity) + allocateQty,
            })

            remaining -= allocateQty
          }

          if (remaining > 0) {
            allItemsAllocated = false
            logger.warn(
              `${LOG} Insufficient stock for variant ${variantId} in order ${ext.order_id} ` +
                `(need ${remaining} more)`
            )
          }
        }

        if (allItemsAllocated) {
          await pharmaOrderService.updateOrderExtensions(ext.id, {
            status: "ready_for_dispatch",
          })
          await pharmaOrderService.createOrderStateHistorys({
            order_id: ext.order_id,
            from_status: "payment_captured",
            to_status: "ready_for_dispatch",
            changed_by: "system:auto-allocate-fefo",
            reason: "FEFO allocation complete",
          })
          allocated++
        }
      } catch (err) {
        failed++
        logger.error(`${LOG} Order ${ext.order_id}: ${(err as Error).message}`)
      }
    }

    logger.info(`${LOG} Done — allocated: ${allocated}, failed: ${failed}, total: ${pendingOrders.length}`)
  } catch (err) {
    logger.error(`${LOG} Failed: ${(err as Error).message}`)
  }
}

export const config = {
  name: "auto-allocate-fefo",
  schedule: "*/5 * * * *",
}
