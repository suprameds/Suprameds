import type { SubscriberArgs, SubscriberConfig } from "@medusajs/framework"
import {
  ContainerRegistrationKeys,
  FulfillmentWorkflowEvents,
  Modules,
} from "@medusajs/framework/utils"
import { completeOrderWorkflow } from "@medusajs/medusa/core-flows"
import { sendPushToCustomerTopic } from "../lib/firebase-messaging"

const LOG = "[subscriber:complete-order-on-delivery]"

type DeliveryCreatedPayload = { id: string }

/**
 * When a fulfillment is marked **Delivered** in Admin, Medusa emits
 * `delivery.created` (see markOrderFulfillmentAsDeliveredWorkflow).
 *
 * We complete the **order record** (`order.status` → `completed`) only when:
 * - The order is still `pending`
 * - Medusa has set `fulfillment_status` to `delivered` (entire order delivered —
 *   safe for multi-fulfillment: we wait until aggregate status is delivered)
 *
 * Also sends a push notification to the customer.
 */
export default async function completeOrderOnDeliveryHandler({
  event: { data },
  container,
}: SubscriberArgs<DeliveryCreatedPayload>) {
  const fulfillmentId = data?.id
  if (!fulfillmentId) {
    console.warn(`${LOG} Missing fulfillment id in event payload`)
    return
  }

  try {
    const query = container.resolve(ContainerRegistrationKeys.QUERY)

    const { data: rows } = await query.graph({
      entity: "fulfillment",
      fields: ["id", "order.id", "order.status", "order.fulfillment_status", "order.customer_id", "order.display_id"],
      filters: { id: fulfillmentId },
    })

    const order = (rows as { order?: {
      id: string
      status: string
      fulfillment_status?: string
      customer_id?: string
      display_id?: number
    } }[])?.[0]?.order

    if (!order?.id) {
      console.warn(`${LOG} Could not resolve order for fulfillment ${fulfillmentId}`)
      return
    }

    const { id: orderId, status, fulfillment_status, customer_id, display_id } = order

    // --- Push notification (fire regardless of auto-complete eligibility) ---
    if (customer_id && fulfillment_status === "delivered") {
      try {
        const result = await sendPushToCustomerTopic(customer_id, {
          title: "Order Delivered",
          body: `Your order #${display_id ?? orderId} has been delivered. Thank you for choosing Suprameds!`,
          data: {
            type: "order_delivered",
            order_id: orderId,
            url: `/in/order/${orderId}/confirmed`,
          },
        })
        if (result.ok) {
          console.info(`${LOG} Push sent for order ${orderId} delivery`)
        } else {
          console.warn(`${LOG} Push skipped for order ${orderId} (${result.reason})`)
        }
      } catch (pushErr) {
        console.warn(`${LOG} Push failed for order ${orderId}: ${(pushErr as Error).message}`)
      }
    }

    // --- Auto-complete order ---
    if (status !== "pending") {
      console.info(
        `${LOG} Order ${orderId} status is "${status}" — skip auto-complete (only pending is updated)`
      )
      return
    }

    if (fulfillment_status !== "delivered") {
      console.info(
        `${LOG} Order ${orderId} fulfillment_status is "${fulfillment_status ?? "n/a"}" — ` +
          `waiting until entire order is delivered before completing`
      )
      return
    }

    console.info(
      `${LOG} Completing order ${orderId} after delivery (fulfillment ${fulfillmentId})`
    )

    await completeOrderWorkflow(container).run({
      input: {
        orderIds: [orderId],
        additional_data: {
          source: "subscriber:delivery.created",
          fulfillment_id: fulfillmentId,
        },
      },
    })

    const orderService = container.resolve(Modules.ORDER) as {
      retrieveOrder: (id: string, config: object) => Promise<{ status: string }>
    }
    const updated = await orderService.retrieveOrder(orderId, {})

    console.info(
      `${LOG} Order ${orderId} workflow finished — status is now "${updated.status}"`
    )
  } catch (err) {
    // Never break fulfillment flow
    console.error(
      `${LOG} Failed to auto-complete order for fulfillment ${fulfillmentId}:`,
      (err as Error).message,
      (err as Error).stack
    )
  }
}

export const config: SubscriberConfig = {
  event: FulfillmentWorkflowEvents.DELIVERY_CREATED,
}
