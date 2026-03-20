import type { SubscriberArgs, SubscriberConfig } from "@medusajs/framework"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import { sendPushToCustomerTopic } from "../lib/firebase-messaging"

type OrderDispatchedData = {
  id?: string
  order_id?: string
}

export default async function handler({
  event: { data },
  container,
}: SubscriberArgs<OrderDispatchedData>) {
  const logger = container.resolve("logger") as {
    info: (msg: string) => void
    warn: (msg: string) => void
    error: (msg: string) => void
  }

  let orderId = data.order_id

  // In some flows `order.dispatched` may provide a fulfillment id as `id`.
  if (!orderId && data.id) {
    try {
      const query = container.resolve(ContainerRegistrationKeys.QUERY)
      const { data: rows } = await query.graph({
        entity: "fulfillment",
        fields: ["id", "order.id"],
        filters: { id: data.id },
      })
      const maybeOrderId = (rows as { order?: { id?: string } }[])?.[0]?.order?.id
      if (maybeOrderId) orderId = maybeOrderId
    } catch {
      // Fall through — we still log below if unresolved.
    }
  }

  if (!orderId) {
    logger.warn("[subscriber] order.dispatched: unable to resolve order id from event payload")
    return
  }

  try {
    const orderService = container.resolve(Modules.ORDER) as any
    const order = await orderService.retrieveOrder(orderId, {})

    if (!order?.customer_id) {
      logger.info(`[subscriber] order.dispatched: order ${orderId} has no customer_id, skipping push`)
      return
    }

    const result = await sendPushToCustomerTopic(order.customer_id, {
      title: "Order Shipped",
      body: `Your order #${order.display_id ?? order.id} is on the way.`,
      data: {
        type: "order_shipped",
        order_id: order.id,
        url: `/in/account/orders/${order.id}`,
      },
    })

    if (!result.ok) {
      logger.warn(
        `[subscriber] order.dispatched: push skipped for order ${orderId} (${result.reason})`
      )
      return
    }

    logger.info(`[subscriber] order.dispatched: push sent for order ${orderId}`)
  } catch (err) {
    logger.error(
      `[subscriber] order.dispatched: failed for order ${orderId} - ${(err as Error).message}`
    )
  }
}

export const config: SubscriberConfig = { event: "order.dispatched" }
