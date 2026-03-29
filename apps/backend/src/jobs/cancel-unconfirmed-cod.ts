import { MedusaContainer } from "@medusajs/framework/types"
import { Modules } from "@medusajs/framework/utils"
import { COD_MODULE } from "../modules/cod"
import { ORDERS_MODULE } from "../modules/orders"

const LOG_PREFIX = "[job:cancel-cod]"

/**
 * Scheduled job: cancel unconfirmed COD orders after 30 minutes.
 *
 * Runs every 15 minutes. For each expired COD order:
 *   1. Cancels the COD order record
 *   2. Transitions the pharmaOrder extension to "cancelled"
 *   3. Emits a cod.unconfirmed_timeout event for downstream processing
 */
export default async function CancelUnconfirmedCodJob(container: MedusaContainer) {
  const logger = container.resolve("logger")
  const codService = container.resolve(COD_MODULE) as any
  const orderService = container.resolve(ORDERS_MODULE) as any
  const eventBus = container.resolve(Modules.EVENT_BUS) as any

  logger.info(`${LOG_PREFIX} Starting unconfirmed COD cancellation sweep`)

  try {
    const cancelledIds = await codService.autoCancelExpired()

    if (cancelledIds.length === 0) {
      logger.info(`${LOG_PREFIX} No expired COD orders found`)
      return
    }

    logger.info(
      `${LOG_PREFIX} Cancelled ${cancelledIds.length} expired COD order(s): ${cancelledIds.join(", ")}`
    )

    // For each cancelled COD order, update extension + emit event
    for (const codOrderId of cancelledIds) {
      try {
        const codOrder = await codService.retrieveCodOrder(codOrderId)
        const orderId = codOrder.order_id

        // Update pharmaOrder extension
        const [extension] = await orderService.listOrderExtensions(
          { order_id: orderId },
          { take: 1 }
        )

        if (extension && extension.status === "pending_cod_confirmation") {
          await orderService.updateOrderExtensions({
            id: extension.id,
            status: "cancelled",
            cod_confirmation_status: "auto_cancelled",
            cancellation_reason: "COD confirmation timed out after 30 minutes",
          })

          await orderService.createOrderStateHistorys({
            order_id: orderId,
            from_status: extension.status,
            to_status: "cancelled",
            changed_by: "system:cancel-cod-job",
            reason: "COD confirmation timed out (scheduled job)",
          })
        }

        // Emit timeout event for subscriber-driven side effects (notifications)
        await eventBus.emit({
          name: "cod.unconfirmed_timeout",
          data: {
            order_id: orderId,
            cod_order_id: codOrderId,
          },
        })
      } catch (innerErr) {
        logger.error(
          `${LOG_PREFIX} Error processing cancelled COD order ${codOrderId}: ${(innerErr as Error).message}`
        )
      }
    }

    logger.info(`${LOG_PREFIX} Sweep complete — ${cancelledIds.length} order(s) cancelled`)
  } catch (err) {
    logger.error(`${LOG_PREFIX} Job failed: ${(err as Error).message}`)
    throw err
  }
}

export const config = {
  name: "cancel-cod",
  // Run every 15 minutes
  schedule: "*/15 * * * *",
}
