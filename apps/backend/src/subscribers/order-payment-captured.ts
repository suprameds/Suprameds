import type { SubscriberArgs, SubscriberConfig } from "@medusajs/framework"
import { Modules } from "@medusajs/framework/utils"
import { ORDERS_MODULE } from "../modules/orders"
import { captureException } from "../lib/sentry"
import { createLogger } from "../lib/logger"

const logger = createLogger("subscriber:order-payment-captured")

type PaymentCapturedData = {
  id: string
  amount?: number
  currency_code?: string
}

export default async function paymentCapturedHandler({
  event: { data },
  container,
}: SubscriberArgs<PaymentCapturedData>) {
  const orderId = data.id
  logger.info(
    `Received event for order ${orderId}` +
      (data.amount != null ? ` — amount: ${data.amount} ${data.currency_code ?? ""}` : "")
  )

  try {
    // ── 1. Retrieve order for context ───────────────────────────────
    const orderService = container.resolve(Modules.ORDER) as any

    const order = await orderService.retrieveOrder(orderId, {
      relations: ["items", "items.variant"],
    })

    logger.info(
      `Order ${orderId}: ${order.items?.length ?? 0} item(s), total ${order.total}`
    )

    // ── 2. Update pharmaOrder extension status ──────────────────────
    try {
      const pharmaOrderService = container.resolve(ORDERS_MODULE) as any

      // Find the existing extension for this order
      const [existing] = await pharmaOrderService.listOrderExtensions(
        { order_id: orderId },
        { take: 1 }
      )

      if (!existing) {
        logger.warn(`No OrderExtension found for order ${orderId}, creating one`)
        await pharmaOrderService.createOrderExtensions({
          order_id: orderId,
          status: "payment_captured",
          payment_captured_amount: data.amount ?? Number(order.total) ?? 0,
        })
      } else {
        const previousStatus = existing.status

        // Only transition if the order isn't already past payment_captured
        const prePaymentStatuses = [
          "pending_cod_confirmation",
          "pending_rx_review",
          "partially_approved",
          "fully_approved",
        ]

        if (prePaymentStatuses.includes(previousStatus)) {
          await pharmaOrderService.updateOrderExtensions({
            id: existing.id,
            status: "payment_captured",
            payment_captured_amount: data.amount ?? Number(order.total) ?? 0,
          })

          // Record state transition
          await pharmaOrderService.createOrderStateHistorys({
            order_id: orderId,
            from_status: previousStatus,
            to_status: "payment_captured",
            changed_by: "system:payment-captured-subscriber",
            reason: `Payment captured: ${data.amount ?? order.total} ${data.currency_code ?? "INR"}`,
          })

          logger.info(
            `OrderExtension updated for ${orderId}: ` +
              `${previousStatus} → payment_captured`
          )
        } else {
          logger.info(
            `Order ${orderId} already in status "${previousStatus}", ` +
              `skipping transition to payment_captured`
          )
        }
      }
    } catch (extError) {
      logger.warn(
        `pharmaOrder extension update failed for ${orderId}:`,
        (extError as Error).message
      )
      captureException(extError, { subscriber: "order-payment-captured", orderId, step: "update-extension" })
    }

    // FEFO allocation is handled at fulfillment time via the
    // createOrderFulfillmentWorkflow.hooks.fulfillmentCreated hook.
    // See: src/workflows/hooks/fulfillment-fefo-mrp-check.ts

    // ── 3. Send payment confirmation notification ───────────────────
    try {
      const notificationService = container.resolve(Modules.NOTIFICATION) as any

      await notificationService.createNotifications({
        to: order.email ?? "",
        channel: "email",
        template: "payment-confirmed",
        data: {
          order_id: orderId,
          display_id: order.display_id,
          amount: data.amount ?? order.total,
          currency_code: data.currency_code ?? "INR",
        },
      })
      logger.info(`Payment confirmation notification sent for order ${orderId}`)
    } catch (notifError) {
      logger.warn(
        `Payment notification failed for ${orderId}:`,
        (notifError as Error).message
      )
      captureException(notifError, { subscriber: "order-payment-captured", orderId, step: "send-notification" })
    }

    logger.info(`Completed processing for order ${orderId}`)
  } catch (error) {
    // Top-level catch — subscriber failures must NOT break the order flow
    logger.error(
      `Unhandled error processing order ${orderId}:`,
      (error as Error).message,
      (error as Error).stack
    )
    captureException(error, { subscriber: "order-payment-captured", orderId })
  }
}

export const config: SubscriberConfig = { event: "order.payment_captured" }
