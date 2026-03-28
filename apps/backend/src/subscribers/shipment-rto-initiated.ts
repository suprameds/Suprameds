import type { SubscriberArgs, SubscriberConfig } from "@medusajs/framework"
import { Modules } from "@medusajs/framework/utils"
import { sendPushToCustomerTopic } from "../lib/firebase-messaging"
import { NOTIFICATION_MODULE } from "../modules/notification"
import { captureException } from "../lib/sentry"

interface RtoEventData {
  shipment_id: string
  order_id: string
}

export default async function handler({
  event,
  container,
}: SubscriberArgs<RtoEventData>) {
  const { shipment_id, order_id } = event.data
  const logger = container.resolve("logger")

  logger.info(
    `[subscriber] shipment.rto_initiated — shipment=${shipment_id} order=${order_id}`
  )

  // Fetch order to get customer_id and display_id
  const orderService = container.resolve(Modules.ORDER) as any
  const order = await orderService.retrieveOrder(order_id)
  const customerId: string = order.customer_id
  const displayId: string = order.display_id ?? order_id

  // Push notification to customer
  try {
    await sendPushToCustomerTopic(customerId, {
      title: "Order Returning to Warehouse",
      body: `Order #${displayId} could not be delivered and is being returned.`,
      data: {
        type: "rto",
        order_id,
        url: `/in/account/orders/${order_id}`,
      },
    })
  } catch (err) {
    logger.warn(`[subscriber] RTO push notification failed: ${(err as Error).message}`)
    captureException(err, { subscriber: "shipment-rto-initiated", shipmentId: shipment_id, orderId: order_id, step: "push-notification" })
  }

  // Internal admin notification
  try {
    const notificationService = container.resolve(NOTIFICATION_MODULE) as any
    await notificationService.createInternalNotifications({
      user_id: "system",
      role_scope: "admin",
      type: "dispatch_pending",
      title: `RTO Initiated — Order #${displayId}`,
      body: `Shipment ${shipment_id} is returning to warehouse. Review order for refund or re-ship.`,
      reference_type: "shipment",
      reference_id: shipment_id,
    })
  } catch (err) {
    logger.warn(`[subscriber] RTO internal notification failed: ${(err as Error).message}`)
    captureException(err, { subscriber: "shipment-rto-initiated", shipmentId: shipment_id, orderId: order_id, step: "internal-notification" })
  }
}

export const config: SubscriberConfig = { event: "shipment.rto_initiated" }
