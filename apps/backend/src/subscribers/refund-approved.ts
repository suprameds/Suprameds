import type { SubscriberArgs, SubscriberConfig } from "@medusajs/framework"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { NOTIFICATION_MODULE } from "../modules/notification"
import { PAYMENT_MODULE } from "../modules/payment"
import { ProcessRefundWorkflow } from "../workflows/payment/process-refund"
import { captureException } from "../lib/sentry"

const LOG = "[subscriber:refund-approved]"

type RefundApprovedData = {
  refund_id: string
  order_id: string
}

/**
 * Subscriber: refund.approved
 *
 * Fires when finance_admin approves a refund request.
 * - Creates an internal notification for audit trail.
 * - For Razorpay payments (non-COD): automatically triggers the process-refund workflow
 *   so the gateway refund is initiated without a separate manual step.
 * - For COD payments: notifies finance team to collect bank details if not yet submitted.
 */
export default async function refundApprovedHandler({
  event: { data },
  container,
}: SubscriberArgs<RefundApprovedData>) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER) as any
  const { refund_id, order_id } = data

  logger.info(`${LOG} Refund approved — refund: ${refund_id}, order: ${order_id}`)

  try {
    const notifService = container.resolve(NOTIFICATION_MODULE) as any

    await notifService.createInternalNotifications({
      user_id: "system",
      role_scope: "finance_admin",
      type: "refund_approved",
      title: `Refund Approved — Order ${order_id}`,
      body: `Refund ${refund_id} for order ${order_id} has been approved and is being processed.`,
      reference_type: "refund",
      reference_id: refund_id,
    })
  } catch (err) {
    logger.warn(`${LOG} Internal notification failed: ${(err as Error).message}`)
    captureException(err, { subscriber: "refund-approved", refundId: refund_id, orderId: order_id, step: "internal-notification" })
  }

  // Determine payment method to decide whether to auto-process
  try {
    const paymentService = container.resolve(PAYMENT_MODULE) as any

    const [refund] = await paymentService.listRefunds(
      { id: refund_id },
      { select: ["id", "payment_id"] }
    )

    if (!refund) {
      logger.warn(`${LOG} Refund ${refund_id} not found for auto-process check`)
      return
    }

    const [payment] = await paymentService.listPaymentRecords(
      { id: refund.payment_id },
      { select: ["id", "gateway", "payment_method"] }
    )

    const isPrepaid = payment?.gateway === "paytm" || payment?.gateway === "razorpay"
    const isCod = payment?.gateway === "cod" || payment?.payment_method === "cod"

    if (isPrepaid) {
      // Auto-process prepaid (Paytm/Razorpay) refunds immediately after approval
      logger.info(`${LOG} Auto-processing ${payment.gateway} refund ${refund_id}`)

      try {
        // Resolve the container's DI scope for workflow execution
        const moduleContainer = container as any
        await ProcessRefundWorkflow(moduleContainer).run({
          input: { refund_id },
        })
        logger.info(`${LOG} Auto-processed refund ${refund_id} via ${payment.gateway}`)
      } catch (workflowErr: any) {
        logger.error(
          `${LOG} Auto-process workflow failed for refund ${refund_id}: ${workflowErr.message}. ` +
            `Finance team must manually process via POST /admin/refunds/${refund_id}/process.`
        )
        captureException(workflowErr, { subscriber: "refund-approved", refundId: refund_id, step: "auto-process-workflow" })
      }
    } else if (isCod) {
      // Check if bank details already exist
      try {
        const notifService = container.resolve(NOTIFICATION_MODULE) as any
        const [codDetails] = await paymentService.listCodRefundDetails({ refund_id })

        if (!codDetails) {
          await notifService.createInternalNotifications({
            user_id: "system",
            role_scope: "finance_admin",
            type: "refund_cod_bank_details_required",
            title: `COD Refund — Bank Details Required`,
            body:
              `Refund ${refund_id} (order ${order_id}) is a COD order. ` +
              `Please collect customer bank/UPI details and submit via Admin → Refunds → COD Bank Details.`,
            reference_type: "refund",
            reference_id: refund_id,
          })
          logger.info(`${LOG} COD bank details notification sent for refund ${refund_id}`)
        } else {
          logger.info(
            `${LOG} COD refund ${refund_id} already has bank details. Finance team can process via POST /admin/refunds/${refund_id}/process.`
          )
        }
      } catch (codErr: any) {
        logger.warn(`${LOG} COD detail check failed: ${codErr.message}`)
        captureException(codErr, { subscriber: "refund-approved", refundId: refund_id, step: "cod-detail-check" })
      }
    } else {
      logger.info(`${LOG} Refund ${refund_id} — unknown gateway. Skipping auto-process.`)
    }
  } catch (err) {
    logger.error(
      `${LOG} Payment method resolution failed for refund ${refund_id}: ${(err as Error).message}`
    )
    captureException(err, { subscriber: "refund-approved", refundId: refund_id, orderId: order_id })
  }
}

export const config: SubscriberConfig = { event: "refund.approved" }
