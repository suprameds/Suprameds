import type { SubscriberArgs, SubscriberConfig } from "@medusajs/framework"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { NOTIFICATION_MODULE } from "../modules/notification"

const LOG = "[subscriber:refund-raised]"

type RefundRaisedData = {
  refund_id: string
  order_id: string
}

/**
 * Subscriber: refund.raised
 *
 * Fires when a support_agent raises a new refund request.
 * Creates an internal notification for the finance_admin role
 * so they can review and approve the refund via the admin dashboard.
 */
export default async function refundRaisedHandler({
  event: { data },
  container,
}: SubscriberArgs<RefundRaisedData>) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER) as any
  const { refund_id, order_id } = data

  logger.info(`${LOG} Refund raised — refund: ${refund_id}, order: ${order_id}`)

  try {
    const notifService = container.resolve(NOTIFICATION_MODULE) as any

    await notifService.createInternalNotifications({
      user_id: "system",
      role_scope: "finance_admin",
      type: "refund_pending_approval",
      title: `Refund Request — Order ${order_id}`,
      body:
        `A new refund request (${refund_id}) has been raised for order ${order_id} and is pending your approval. ` +
        `Review it via Admin → Refunds.`,
      reference_type: "refund",
      reference_id: refund_id,
    })

    logger.info(`${LOG} Finance admin notification created for refund ${refund_id}`)
  } catch (err) {
    // Subscriber failures must not break the refund raise flow
    logger.error(
      `${LOG} Failed to create notification for refund ${refund_id}: ${(err as Error).message}`
    )
  }
}

export const config: SubscriberConfig = { event: "refund.raised" }
