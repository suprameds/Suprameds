import type { SubscriberArgs, SubscriberConfig } from "@medusajs/framework"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { NOTIFICATION_MODULE } from "../modules/notification"

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
export default async function handler({
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
  }
}

export const config: SubscriberConfig = { event: "return.received" }
