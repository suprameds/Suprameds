import type { SubscriberArgs, SubscriberConfig } from "@medusajs/framework"
import { Modules } from "@medusajs/framework/utils"
import { sendPushToCustomerTopic } from "../lib/firebase-messaging"

const LOG = "[subscriber:order-canceled]"

type OrderCanceledData = {
  id?: string
}

export default async function handler({
  event: { data },
  container,
}: SubscriberArgs<OrderCanceledData>) {
  const orderId = data?.id
  if (!orderId) {
    console.warn(`${LOG} Missing order id in event payload`)
    return
  }

  try {
    const orderService = container.resolve(Modules.ORDER) as any
    const order = await orderService.retrieveOrder(orderId, {})

    if (!order?.customer_id) {
      console.info(`${LOG} Order ${orderId} has no customer_id, skipping push`)
      return
    }

    const result = await sendPushToCustomerTopic(order.customer_id, {
      title: "Order Cancelled",
      body: `Your order #${order.display_id ?? orderId} has been cancelled. If this was unexpected, please contact us.`,
      data: {
        type: "order_cancelled",
        order_id: orderId,
        url: `/in/order/${orderId}/confirmed`,
      },
    })

    if (result.ok) {
      console.info(`${LOG} Push sent for order ${orderId}`)
    } else {
      console.warn(`${LOG} Push skipped for order ${orderId} (${result.reason})`)
    }
  } catch (err) {
    console.error(`${LOG} Failed for order ${orderId}: ${(err as Error).message}`)
  }
}

export const config: SubscriberConfig = { event: "order.canceled" }
