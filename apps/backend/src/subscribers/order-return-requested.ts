import type { SubscriberArgs, SubscriberConfig } from "@medusajs/framework"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { NOTIFICATION_MODULE } from "../modules/notification"
import { captureException } from "../lib/sentry"

const LOG_PREFIX = "[subscriber:return-requested]"

type ReturnRequestedData = {
  id: string
  order_id?: string
  return_id?: string
}

/**
 * Subscriber: order.return_requested
 *
 * Fires when a customer initiates a return request.
 * Creates an internal notification for warehouse staff so they can
 * prepare for the incoming return shipment and schedule inspection.
 */
export default async function orderReturnRequestedHandler({
  event: { data },
  container,
}: SubscriberArgs<ReturnRequestedData>) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER) as any
  const returnId = data.return_id ?? data.id
  const orderId = data.order_id ?? "unknown"

  logger.info(`${LOG_PREFIX} Return requested — return: ${returnId}, order: ${orderId}`)

  try {
    const notificationService = container.resolve(NOTIFICATION_MODULE) as any

    // Create internal notification for warehouse team
    await notificationService.createInternalNotifications({
      user_id: "system",
      role_scope: "warehouse",
      type: "return_requested",
      title: "New Return Request",
      body: `Return request ${returnId} raised for order ${orderId}. Await package arrival for inspection.`,
      reference_type: "return",
      reference_id: returnId,
    })

    logger.info(`${LOG_PREFIX} Internal notification created for return ${returnId}`)
  } catch (err) {
    // Subscriber failures must not break the return flow
    logger.error(
      `${LOG_PREFIX} Failed to process return request ${returnId}: ${(err as Error).message}`
    )
    captureException(err, { subscriber: "order-return-requested", returnId, orderId })
  }
}

export const config: SubscriberConfig = { event: "order.return_requested" }
