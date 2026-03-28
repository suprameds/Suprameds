import type { SubscriberArgs, SubscriberConfig } from "@medusajs/framework"
import { INotificationModuleService } from "@medusajs/framework/types"
import {
  ContainerRegistrationKeys,
  FulfillmentWorkflowEvents,
  Modules,
} from "@medusajs/framework/utils"
import { completeOrderWorkflow } from "@medusajs/medusa/core-flows"
import { sendPushToCustomerTopic } from "../lib/firebase-messaging"
import { captureException } from "../lib/sentry"
import { createLogger } from "../lib/logger"

const logger = createLogger("subscriber:order-delivered")
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
    logger.warn(`Missing fulfillment id in event payload`)
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
      logger.warn(`Could not resolve order for fulfillment ${fulfillmentId}`)
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
          logger.info(`Push sent for order ${orderId} delivery`)
        } else {
          logger.warn(`Push skipped for order ${orderId} (${result.reason})`)
        }
      } catch (pushErr) {
        logger.warn(`Push failed for order ${orderId}: ${(pushErr as Error).message}`)
        captureException(pushErr, { subscriber: "order-delivered", orderId: orderId, step: "push-notification" })
      }

      // --- Email notification ---
      try {
        let emailTo: string | null = null

        // Try to get email from the order, then fall back to customer lookup
        try {
          const orderService = container.resolve(Modules.ORDER) as any
          const orderWithEmail = await orderService.retrieveOrder(orderId, {})
          emailTo = orderWithEmail?.email ?? null
        } catch {
          // Fall through
        }

        if (!emailTo && customer_id) {
          try {
            const customerService = container.resolve(Modules.CUSTOMER) as any
            const customer = await customerService.retrieveCustomer(customer_id)
            emailTo = customer?.email ?? null
          } catch {
            // Fall through
          }
        }

        if (emailTo) {
          // Retrieve order items for the email
          let items: { title: string; quantity: number }[] = []
          try {
            const orderService = container.resolve(Modules.ORDER) as any
            const fullOrder = await orderService.retrieveOrder(orderId, {
              relations: ["items"],
            })
            items = fullOrder?.items?.map((item: any) => ({
              title: item.title,
              quantity: item.quantity,
            })) ?? []
          } catch {
            // Items are best-effort for the email
          }

          const notificationService: INotificationModuleService = container.resolve(
            Modules.NOTIFICATION
          )
          await notificationService.createNotifications({
            to: emailTo,
            channel: "email",
            template: "delivery-confirmation",
            data: {
              order_id: orderId,
              display_id: display_id ?? orderId,
              delivered_at: new Date().toLocaleDateString("en-IN", {
                year: "numeric",
                month: "long",
                day: "numeric",
                hour: "2-digit",
                minute: "2-digit",
              }),
              items,
            },
          })
          logger.info(`Delivery email sent to ${emailTo} for order ${orderId}`)
        } else {
          logger.warn(`No email found for order ${orderId} — skipping delivery email`)
        }
      } catch (emailErr) {
        logger.warn(`Delivery email failed for order ${orderId}: ${(emailErr as Error).message}`)
        captureException(emailErr, { subscriber: "order-delivered", orderId: orderId, step: "send-email" })
      }
    }

    // --- Auto-complete order ---
    if (status !== "pending") {
      logger.info(
        `Order ${orderId} status is "${status}" — skip auto-complete (only pending is updated)`
      )
      return
    }

    if (fulfillment_status !== "delivered") {
      logger.info(
        `Order ${orderId} fulfillment_status is "${fulfillment_status ?? "n/a"}" — ` +
          `waiting until entire order is delivered before completing`
      )
      return
    }

    logger.info(
      `Completing order ${orderId} after delivery (fulfillment ${fulfillmentId})`
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

    logger.info(
      `Order ${orderId} workflow finished — status is now "${updated.status}"`
    )
  } catch (err) {
    // Never break fulfillment flow
    logger.error(
      `Failed to auto-complete order for fulfillment ${fulfillmentId}:`,
      (err as Error).message,
      (err as Error).stack
    )
    captureException(err, { subscriber: "order-delivered", fulfillmentId })
  }
}

export const config: SubscriberConfig = {
  event: FulfillmentWorkflowEvents.DELIVERY_CREATED,
}
