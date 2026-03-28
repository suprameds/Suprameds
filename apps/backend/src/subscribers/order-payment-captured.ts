import type { SubscriberArgs, SubscriberConfig } from "@medusajs/framework"
import { Modules } from "@medusajs/framework/utils"
import { ORDERS_MODULE } from "../modules/orders"
import { captureException } from "../lib/sentry"

const LOG_PREFIX = "[subscriber:payment-captured]"

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
  console.info(
    `${LOG_PREFIX} Received event for order ${orderId}` +
      (data.amount != null ? ` — amount: ${data.amount} ${data.currency_code ?? ""}` : "")
  )

  try {
    // ── 1. Retrieve order for context ───────────────────────────────
    const orderService = container.resolve(Modules.ORDER) as any

    const order = await orderService.retrieveOrder(orderId, {
      relations: ["items", "items.variant"],
    })

    console.info(
      `${LOG_PREFIX} Order ${orderId}: ${order.items?.length ?? 0} item(s), total ${order.total}`
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
        console.warn(`${LOG_PREFIX} No OrderExtension found for order ${orderId}, creating one`)
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
          await pharmaOrderService.updateOrderExtensions(existing.id, {
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

          console.info(
            `${LOG_PREFIX} OrderExtension updated for ${orderId}: ` +
              `${previousStatus} → payment_captured`
          )
        } else {
          console.info(
            `${LOG_PREFIX} Order ${orderId} already in status "${previousStatus}", ` +
              `skipping transition to payment_captured`
          )
        }
      }
    } catch (extError) {
      console.warn(
        `${LOG_PREFIX} pharmaOrder extension update failed for ${orderId}:`,
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
      console.info(`${LOG_PREFIX} Payment confirmation notification sent for order ${orderId}`)
    } catch (notifError) {
      console.warn(
        `${LOG_PREFIX} Payment notification failed for ${orderId}:`,
        (notifError as Error).message
      )
      captureException(notifError, { subscriber: "order-payment-captured", orderId, step: "send-notification" })
    }

    console.info(`${LOG_PREFIX} Completed processing for order ${orderId}`)
  } catch (error) {
    // Top-level catch — subscriber failures must NOT break the order flow
    console.error(
      `${LOG_PREFIX} Unhandled error processing order ${orderId}:`,
      (error as Error).message,
      (error as Error).stack
    )
    captureException(error, { subscriber: "order-payment-captured", orderId })
  }
}

export const config: SubscriberConfig = { event: "order.payment_captured" }
