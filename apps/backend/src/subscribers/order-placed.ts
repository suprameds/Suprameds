import type { SubscriberArgs, SubscriberConfig } from "@medusajs/framework"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import { ORDERS_MODULE } from "../modules/orders"
import { NOTIFICATION_MODULE } from "../modules/notification"
import { PRESCRIPTION_MODULE } from "../modules/prescription"
import { captureException } from "../lib/sentry"
import { createLogger } from "../lib/logger"

const logger = createLogger("subscriber:order-placed")

type OrderPlacedData = { id: string }

export default async function orderPlacedHandler({
  event: { data },
  container,
}: SubscriberArgs<OrderPlacedData>) {
  const orderId = data.id
  logger.info(`Received event for order ${orderId}`)

  try {
    // ── 1. Retrieve full order details ──────────────────────────────
    const orderService = container.resolve(Modules.ORDER) as any

    const order = await orderService.retrieveOrder(orderId, {
      relations: [
        "items",
        "items.variant",
        "shipping_address",
        "billing_address",
        "shipping_methods",
      ],
    })

    const itemCount = order.items?.length ?? 0
    const shippingCity = order.shipping_address?.city ?? "N/A"
    logger.info(
      `Order ${orderId}: ${itemCount} item(s), shipping to ${shippingCity}, total ${order.total}`
    )

    // ── 1b. Link prescription to order (if attached during checkout) ─
    try {
      const prescriptionId = (order.metadata as any)?.prescription_id
      if (prescriptionId) {
        const prescriptionService = container.resolve(PRESCRIPTION_MODULE) as any
        const [rx] = await prescriptionService.listPrescriptions(
          { id: prescriptionId },
          { take: 1 }
        )

        if (rx) {
          const linkService = container.resolve(ContainerRegistrationKeys.LINK) as any
          await linkService.create({
            [Modules.ORDER]: { order_id: orderId },
            [PRESCRIPTION_MODULE]: { prescription_id: prescriptionId },
          })
          logger.info(
            `Linked prescription ${prescriptionId} to order ${orderId}`
          )
        } else {
          logger.warn(
            `Prescription ${prescriptionId} referenced in order metadata not found`
          )
        }
      }
    } catch (linkErr) {
      logger.warn(
        `Failed to link prescription to order ${orderId}:`,
        (linkErr as Error).message
      )
      captureException(linkErr, { subscriber: "order-placed", orderId, step: "link-prescription" })
    }

    // ── 2. Send customer confirmation notification ──────────────────
    try {
      const notificationService = container.resolve(Modules.NOTIFICATION) as any

      await notificationService.createNotifications({
        to: order.email ?? "",
        channel: "email",
        template: "order-confirmation",
        data: {
          order_id: orderId,
          display_id: order.display_id,
          items: order.items?.map((item) => ({
            title: item.title,
            quantity: item.quantity,
            unit_price: item.unit_price,
          })),
          total: order.total,
          shipping_address: order.shipping_address,
        },
      })
      logger.info(`Confirmation notification sent for order ${orderId}`)
    } catch (notifError) {
      // Notification module may not be fully configured — log and continue
      logger.warn(
        `Notification send failed for order ${orderId}, logging summary instead:`,
        (notifError as Error).message
      )
      captureException(notifError, { subscriber: "order-placed", orderId, step: "send-notification" })
      logger.info(
        `Order summary — ID: ${orderId}, ` +
          `Items: ${order.items?.map((i) => `${i.title} x${i.quantity}`).join(", ")}, ` +
          `Total: ₹${order.total}, ` +
          `Ship to: ${order.shipping_address?.address_1 ?? ""}, ${shippingCity}`
      )
    }

    // ── 3. Create pharmaOrder extension record ──────────────────────
    try {
      const pharmaOrderService = container.resolve(ORDERS_MODULE) as any

      const prescriptionId = (order.metadata as any)?.prescription_id
      const isRxOrder = !!prescriptionId || (order.items?.some(
        (item: any) => item.metadata?.requires_prescription === true
      ) ?? false)

      const extension = await pharmaOrderService.createOrderExtensions({
        order_id: orderId,
        is_rx_order: isRxOrder,
        status: isRxOrder ? "pending_rx_review" : "payment_captured",
      })

      // Record initial state history
      await pharmaOrderService.createOrderStateHistorys({
        order_id: orderId,
        from_status: "none",
        to_status: extension.status,
        changed_by: "system:order-placed-subscriber",
        reason: "Order placed",
      })

      logger.info(
        `OrderExtension created for ${orderId} — ` +
          `is_rx: ${isRxOrder}, initial status: ${extension.status}`
      )
    } catch (extError) {
      // pharmaOrder module may not be active — log and continue
      logger.warn(
        `pharmaOrder extension creation failed for ${orderId}:`,
        (extError as Error).message
      )
      captureException(extError, { subscriber: "order-placed", orderId, step: "create-extension" })
    }

    // ── 4. Send internal notification to pharmacy team ──────────────
    try {
      const pharmaNotifService = container.resolve(NOTIFICATION_MODULE) as any

      await pharmaNotifService.createInternalNotifications({
        user_id: "system",
        role_scope: "pharmacist",
        type: "dispatch_pending",
        title: `New order #${order.display_id ?? orderId}`,
        body: `Order placed with ${itemCount} item(s). Total: ₹${order.total}`,
        reference_type: "order",
        reference_id: orderId,
      })
      logger.info(`Internal notification created for order ${orderId}`)
    } catch (internalNotifError) {
      logger.warn(
        `Internal notification failed for ${orderId}:`,
        (internalNotifError as Error).message
      )
      captureException(internalNotifError, { subscriber: "order-placed", orderId, step: "internal-notification" })
    }

    logger.info(`Completed processing for order ${orderId}`)
  } catch (error) {
    // Top-level catch — subscriber failures must NOT break the order flow
    logger.error(
      `Unhandled error processing order ${orderId}:`,
      (error as Error).message,
      (error as Error).stack
    )
    captureException(error, { subscriber: "order-placed", orderId })
  }
}

export const config: SubscriberConfig = { event: "order.placed" }
