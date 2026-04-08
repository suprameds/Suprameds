import type { SubscriberArgs, SubscriberConfig } from "@medusajs/framework"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import { NOTIFICATION_MODULE } from "../modules/notification"
import { WALLET_MODULE } from "../modules/wallet"
import { captureException } from "../lib/sentry"

const LOG_PREFIX = "[subscriber:return-received]"

type ReturnReceivedData = {
  id: string
  order_id?: string
  return_id?: string
}

/**
 * Subscriber: return.received
 *
 * Fires when a returned package physically arrives at the warehouse.
 * Creates an urgent internal notification for warehouse inspectors
 * to perform physical inspection via the admin dashboard.
 *
 * The actual inspection is triggered manually by the inspector
 * through POST /admin/orders/returns (which runs InspectReturnWorkflow).
 */
export default async function returnReceivedHandler({
  event: { data },
  container,
}: SubscriberArgs<ReturnReceivedData>) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER) as any
  const returnId = data.return_id ?? data.id
  const orderId = data.order_id ?? "unknown"

  logger.info(`${LOG_PREFIX} Return package received — return: ${returnId}, order: ${orderId}`)

  try {
    const notificationService = container.resolve(NOTIFICATION_MODULE) as any

    // Notify warehouse inspector that the package has arrived
    await notificationService.createInternalNotifications({
      user_id: "system",
      role_scope: "warehouse",
      type: "return_received",
      title: "Return Package Arrived — Inspection Required",
      body:
        `Return ${returnId} (order ${orderId}) has arrived at the warehouse. ` +
        `Please inspect the items and process via Admin → Orders → Returns.`,
      reference_type: "return",
      reference_id: returnId,
    })

    logger.info(
      `${LOG_PREFIX} Inspection task notification created for return ${returnId}`
    )
  } catch (err) {
    logger.error(
      `${LOG_PREFIX} Failed to process return receipt ${returnId}: ${(err as Error).message}`
    )
    captureException(err, { subscriber: "return-received", returnId, orderId })
  }

  // ── Credit wallet with refund amount ──
  try {
    if (orderId && orderId !== "unknown") {
      const orderService = container.resolve(Modules.ORDER) as any
      const order = await orderService.retrieveOrder(orderId, {
        relations: ["items", "returns"],
      })

      if (order?.customer_id) {
        // Calculate refund amount from the return's items
        // Use order total as fallback if return-level amount isn't available
        const returnData = order.returns?.find((r: any) => r.id === returnId)
        const refundAmount = returnData?.refund_amount ?? order.total ?? 0

        if (refundAmount > 0) {
          const walletService = container.resolve(WALLET_MODULE) as any
          const result = await walletService.creditWallet(
            order.customer_id,
            refundAmount,
            "return",
            returnId,
            `Refund for return ${returnId} (order ${orderId})`
          )

          logger.info(
            `${LOG_PREFIX} Credited ₹${refundAmount} to wallet for return ${returnId} ` +
              `(order ${orderId}, new balance: ₹${result.new_balance})`
          )
        }
      }
    }
  } catch (err) {
    logger.warn(
      `${LOG_PREFIX} Wallet credit failed for return ${returnId}: ${(err as Error).message}`
    )
    captureException(err, { subscriber: "return-received", returnId, orderId, step: "wallet-credit" })
  }
}

export const config: SubscriberConfig = { event: "return.received" }
