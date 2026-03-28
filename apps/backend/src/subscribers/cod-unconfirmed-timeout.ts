import type { SubscriberArgs, SubscriberConfig } from "@medusajs/framework"
import { Modules } from "@medusajs/framework/utils"
import { ORDERS_MODULE } from "../modules/orders"
import { COD_MODULE } from "../modules/cod"
import { captureException } from "../lib/sentry"

const LOG_PREFIX = "[subscriber:cod-timeout]"

type CodTimeoutData = {
  order_id: string
  cod_order_id: string
}

/**
 * Handles the cod.unconfirmed_timeout event.
 *
 * When a COD order times out (30 min without confirmation):
 *   1. Cancel the COD order record
 *   2. Transition the pharmaOrder extension to "cancelled"
 *   3. Send cancellation notification to the customer
 */
export default async function codUnconfirmedTimeoutHandler({
  event: { data },
  container,
}: SubscriberArgs<CodTimeoutData>) {
  const { order_id, cod_order_id } = data
  console.info(`${LOG_PREFIX} Processing timeout for order ${order_id}`)

  try {
    const codService = container.resolve(COD_MODULE) as any

    // Verify it's still pending — may have been confirmed in the meantime
    const codOrder = await codService.retrieveCodOrder(cod_order_id)

    if (codOrder.status !== "pending_confirmation") {
      console.info(
        `${LOG_PREFIX} COD order ${cod_order_id} already in status "${codOrder.status}", skipping timeout`
      )
      return
    }

    // Cancel the COD order
    await codService.updateCodOrders(cod_order_id, { status: "cancelled" })
    console.info(`${LOG_PREFIX} COD order ${cod_order_id} cancelled due to timeout`)

    // Transition pharmaOrder extension
    try {
      const orderService = container.resolve(ORDERS_MODULE) as any

      const [extension] = await orderService.listOrderExtensions(
        { order_id },
        { take: 1 }
      )

      if (extension && extension.status === "pending_cod_confirmation") {
        const previousStatus = extension.status

        await orderService.updateOrderExtensions(extension.id, {
          status: "cancelled",
          cod_confirmation_status: "auto_cancelled",
          cancellation_reason: "COD confirmation timed out after 30 minutes",
        })

        await orderService.createOrderStateHistorys({
          order_id,
          from_status: previousStatus,
          to_status: "cancelled",
          changed_by: "system:cod-timeout",
          reason: "COD confirmation timed out after 30 minutes",
        })

        console.info(`${LOG_PREFIX} OrderExtension ${extension.id} cancelled`)
      }
    } catch (extErr) {
      console.warn(
        `${LOG_PREFIX} Failed to update order extension: ${(extErr as Error).message}`
      )
      captureException(extErr, { subscriber: "cod-unconfirmed-timeout", orderId: order_id, codOrderId: cod_order_id, step: "update-extension" })
    }

    // Send cancellation notification
    try {
      const notificationService = container.resolve(Modules.NOTIFICATION) as any
      await notificationService.createNotifications({
        to: "",
        channel: "sms",
        template: "cod-order-cancelled-timeout",
        data: { order_id, cod_order_id },
      })
    } catch (notifErr) {
      console.warn(
        `${LOG_PREFIX} Notification failed: ${(notifErr as Error).message}`
      )
      captureException(notifErr, { subscriber: "cod-unconfirmed-timeout", orderId: order_id, codOrderId: cod_order_id, step: "send-notification" })
    }

    console.info(`${LOG_PREFIX} Completed timeout processing for order ${order_id}`)
  } catch (error) {
    console.error(
      `${LOG_PREFIX} Unhandled error: ${(error as Error).message}`,
      (error as Error).stack
    )
    captureException(error, { subscriber: "cod-unconfirmed-timeout", orderId: order_id, codOrderId: cod_order_id })
  }
}

export const config: SubscriberConfig = { event: "cod.unconfirmed_timeout" }
