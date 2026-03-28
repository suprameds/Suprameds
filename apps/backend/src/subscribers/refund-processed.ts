import type { SubscriberArgs, SubscriberConfig } from "@medusajs/framework"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import { NOTIFICATION_MODULE } from "../modules/notification"
import { PAYMENT_MODULE } from "../modules/payment"
import { captureException } from "../lib/sentry"

const LOG = "[subscriber:refund-processed]"

type RefundProcessedData = {
  refund_id: string
  order_id: string
  gateway_refund_id: string | null
}

/**
 * Subscriber: refund.processed
 *
 * Fires when a refund has been successfully processed via the gateway (or manually for COD).
 * Sends a customer-facing notification via email (Resend) to confirm the refund.
 */
export default async function refundProcessedHandler({
  event: { data },
  container,
}: SubscriberArgs<RefundProcessedData>) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER) as any
  const { refund_id, order_id, gateway_refund_id } = data

  logger.info(
    `${LOG} Refund processed — refund: ${refund_id}, order: ${order_id}, gateway_ref: ${gateway_refund_id ?? "N/A"}`
  )

  try {
    // Fetch refund details for the notification body
    const paymentService = container.resolve(PAYMENT_MODULE) as any
    const [refund] = await paymentService.listRefunds(
      { id: refund_id },
      { select: ["id", "amount", "order_id", "reason"] }
    )

    if (!refund) {
      logger.warn(`${LOG} Refund ${refund_id} not found for notification`)
      return
    }

    // Attempt to fetch customer email from the order
    let customerEmail: string | null = null
    try {
      const orderService = container.resolve(Modules.ORDER) as any
      const order = await orderService.retrieveOrder(order_id, {
        relations: ["customer"],
      })
      customerEmail = order?.customer?.email ?? order?.email ?? null
    } catch (err) {
      logger.warn(`${LOG} Could not retrieve order email: ${(err as Error).message}`)
      captureException(err, { subscriber: "refund-processed", refundId: refund_id, orderId: order_id, step: "retrieve-order-email" })
    }

    const amountInRupees = (refund.amount / 100).toFixed(2)
    const refundRef = gateway_refund_id && gateway_refund_id !== "COD-NEFT" && gateway_refund_id !== "MANUAL"
      ? `Reference: ${gateway_refund_id}`
      : gateway_refund_id === "COD-NEFT"
      ? "Transfer will be credited to your bank account within 3–5 business days."
      : "Our team will contact you to complete the refund."

    // Send external email notification via Medusa's notification module
    if (customerEmail) {
      try {
        const notifModule = container.resolve(Modules.NOTIFICATION) as any
        await notifModule.createNotifications({
          to: customerEmail,
          channel: "email",
          template: "refund-processed",
          data: {
            order_id,
            refund_id,
            amount: amountInRupees,
            gateway_refund_id: gateway_refund_id ?? "N/A",
            refund_ref: refundRef,
          },
        })
        logger.info(`${LOG} Customer email sent to ${customerEmail} for refund ${refund_id}`)
      } catch (emailErr: any) {
        logger.warn(`${LOG} External email notification failed: ${emailErr.message}`)
        captureException(emailErr, { subscriber: "refund-processed", refundId: refund_id, orderId: order_id, step: "send-email" })
      }
    } else {
      logger.warn(`${LOG} No customer email found for order ${order_id} — skipping email notification`)
    }

    // Always create an internal notification for the finance team audit trail
    try {
      const notifService = container.resolve(NOTIFICATION_MODULE) as any
      await notifService.createInternalNotifications({
        user_id: "system",
        role_scope: "finance_admin",
        type: "refund_processed",
        title: `Refund Processed — Order ${order_id}`,
        body: `Refund ${refund_id} (₹${amountInRupees}) for order ${order_id} has been processed. ${refundRef}`,
        reference_type: "refund",
        reference_id: refund_id,
      })
    } catch (internalErr: any) {
      logger.warn(`${LOG} Internal notification failed: ${internalErr.message}`)
      captureException(internalErr, { subscriber: "refund-processed", refundId: refund_id, orderId: order_id, step: "internal-notification" })
    }
  } catch (err) {
    // Subscriber failures must not affect the refund record
    logger.error(
      `${LOG} Failed for refund ${refund_id}: ${(err as Error).message}`
    )
    captureException(err, { subscriber: "refund-processed", refundId: refund_id, orderId: order_id })
  }
}

export const config: SubscriberConfig = { event: "refund.processed" }
