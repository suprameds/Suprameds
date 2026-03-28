import type { SubscriberArgs, SubscriberConfig } from "@medusajs/framework"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import { sendPushToCustomerTopic } from "../lib/firebase-messaging"
import { SHIPMENT_MODULE } from "../modules/shipment"

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
    const order = await orderService.retrieveOrder(orderId, {
      relations: ["items"],
    })

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

    // Send email notification to customer
    try {
      const customerEmail = order.email ?? null
      let emailTo = customerEmail

      // If no email on order, look up customer
      if (!emailTo && order.customer_id) {
        try {
          const customerService = container.resolve(Modules.CUSTOMER) as any
          const customer = await customerService.retrieveCustomer(order.customer_id)
          emailTo = customer?.email ?? null
        } catch {
          // Fall through — emailTo stays null
        }
      }

      if (emailTo) {
        // Look up shipment details for AWB/tracking data
        let awbNumber: string | null = null
        let carrier = "India Post"
        let estimatedDelivery: string | null = null
        let trackingUrl: string | null = null

        try {
          const shipmentService = container.resolve(SHIPMENT_MODULE) as any
          const [shipment] = await shipmentService.listShipments(
            { order_id: orderId },
            { take: 1, order: { dispatched_at: "DESC" } }
          )
          if (shipment) {
            awbNumber = shipment.awb_number ?? null
            carrier = shipment.carrier ?? "India Post"
            estimatedDelivery = shipment.estimated_delivery
              ? new Date(shipment.estimated_delivery).toLocaleDateString("en-IN")
              : null
            trackingUrl = awbNumber
              ? `https://www.indiapost.gov.in/_layouts/15/dop.portal.tracking/trackconsignment.aspx?articleid=${awbNumber}`
              : null
          }
        } catch {
          // Shipment lookup is best-effort
        }

        const items = order.items?.map((item: any) => ({
          title: item.title,
          quantity: item.quantity,
        })) ?? []

        const notificationService = container.resolve(Modules.NOTIFICATION) as any
        await notificationService.createNotifications({
          to: emailTo,
          channel: "email",
          template: "shipping-confirmation",
          data: {
            order_id: orderId,
            display_id: order.display_id ?? orderId,
            awb_number: awbNumber ?? "Pending",
            carrier,
            estimated_delivery: estimatedDelivery ?? "5-7 business days",
            tracking_url: trackingUrl,
            items,
          },
        })
        logger.info(`[subscriber] order.dispatched: email sent to ${emailTo} for order ${orderId}`)
      } else {
        logger.warn(
          `[subscriber] order.dispatched: no email found for order ${orderId} — skipping email`
        )
      }
    } catch (emailErr) {
      logger.warn(
        `[subscriber] order.dispatched: email failed for order ${orderId}: ${(emailErr as Error).message}`
      )
    }
  } catch (err) {
    logger.error(
      `[subscriber] order.dispatched: failed for order ${orderId} - ${(err as Error).message}`
    )
  }
}

export const config: SubscriberConfig = { event: "order.dispatched" }
