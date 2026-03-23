import type { SubscriberArgs, SubscriberConfig } from "@medusajs/framework"
import { Modules } from "@medusajs/framework/utils"
import { ORDERS_MODULE } from "../modules/orders"

const LOG = "[subscriber:order-updated]"

/**
 * Fires on any order update. Syncs the pharmaOrder extension status
 * and logs meaningful state changes for audit purposes.
 */
export default async function orderUpdatedHandler({
  event: { data },
  container,
}: SubscriberArgs<{ id: string }>) {
  const orderId = data.id
  if (!orderId) return

  try {
    const orderService = container.resolve(Modules.ORDER) as any
    const order = await orderService.retrieveOrder(orderId, {})

    const {
      status,
      fulfillment_status,
      payment_status,
      display_id,
    } = order

    console.info(
      `${LOG} Order ${display_id ?? orderId} updated — ` +
        `status: ${status}, fulfillment: ${fulfillment_status ?? "n/a"}, ` +
        `payment: ${payment_status ?? "n/a"}`
    )

    // Sync the pharmaOrder extension with the latest Medusa order status
    try {
      const pharmaOrderService = container.resolve(ORDERS_MODULE) as any
      const [extension] = await pharmaOrderService.listOrderExtensions(
        { order_id: orderId },
        { take: 1 }
      )

      if (!extension) return

      // Map fulfillment_status to pharma statuses
      const statusMap: Record<string, string> = {
        shipped: "dispatched",
        delivered: "delivered",
        canceled: "cancelled",
      }

      const newStatus = statusMap[fulfillment_status]
      if (newStatus && extension.status !== newStatus) {
        const prevStatus = extension.status
        await pharmaOrderService.updateOrderExtensions(extension.id, {
          status: newStatus,
        })
        await pharmaOrderService.createOrderStateHistorys({
          order_id: orderId,
          from_status: prevStatus,
          to_status: newStatus,
          changed_by: "system:order-updated-subscriber",
          reason: `Medusa fulfillment_status → ${fulfillment_status}`,
        })
        console.info(
          `${LOG} Extension for ${orderId}: ${prevStatus} → ${newStatus}`
        )
      }
    } catch (err) {
      // pharmaOrder module may not be active
      console.warn(`${LOG} Extension sync failed for ${orderId}: ${(err as Error).message}`)
    }
  } catch (err) {
    console.error(`${LOG} Failed for order ${orderId}: ${(err as Error).message}`)
  }
}

export const config: SubscriberConfig = { event: "order.updated" }
