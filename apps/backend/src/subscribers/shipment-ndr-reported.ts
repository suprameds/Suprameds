import type { SubscriberArgs, SubscriberConfig } from "@medusajs/framework"
import { Modules } from "@medusajs/framework/utils"
import { sendPushToCustomerTopic } from "../lib/firebase-messaging"
import { NOTIFICATION_MODULE } from "../modules/notification"
import { captureException } from "../lib/sentry"

interface NdrEventData {
  shipment_id: string
  order_id: string
  ndr_reason: string
}

export default async function handler({
  event,
  container,
}: SubscriberArgs<NdrEventData>) {
  const { shipment_id, order_id, ndr_reason } = event.data
  const logger = container.resolve("logger")

  logger.info(
    `[subscriber] shipment.ndr_reported — shipment=${shipment_id} order=${order_id} reason=${ndr_reason}`
  )

  // Fetch order to get customer_id and display_id
  const orderService = container.resolve(Modules.ORDER) as any
  const order = await orderService.retrieveOrder(order_id)
  const customerId: string = order.customer_id
  const displayId: string = order.display_id ?? order_id

  // Push notification to customer
  try {
    await sendPushToCustomerTopic(customerId, {
      title: "Delivery Attempt Failed",
      body: `We couldn't deliver order #${displayId}. We'll try again soon.`,
      data: {
        type: "ndr",
        order_id,
        url: `/in/account/orders/${order_id}`,
      },
    })
  } catch (err) {
    logger.warn(`[subscriber] NDR push notification failed: ${(err as Error).message}`)
    captureException(err, { subscriber: "shipment-ndr-reported", shipmentId: shipment_id, orderId: order_id, step: "push-notification" })
  }

  // Internal admin notification
  try {
    const notificationService = container.resolve(NOTIFICATION_MODULE) as any
    await notificationService.createInternalNotifications({
      user_id: "system",
      role_scope: "admin",
      type: "dispatch_pending",
      title: `NDR — Order #${displayId}`,
      body: `${ndr_reason}. Action required: reattempt or RTO.`,
      reference_type: "shipment",
      reference_id: shipment_id,
    })
  } catch (err) {
    logger.warn(`[subscriber] NDR internal notification failed: ${(err as Error).message}`)
    captureException(err, { subscriber: "shipment-ndr-reported", shipmentId: shipment_id, orderId: order_id, step: "internal-notification" })
  }
}

export const config: SubscriberConfig = { event: "shipment.ndr_reported" }
