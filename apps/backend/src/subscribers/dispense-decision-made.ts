import type { SubscriberArgs, SubscriberConfig } from "@medusajs/framework"
import { Modules } from "@medusajs/framework/utils"
import { ORDERS_MODULE } from "../modules/orders"
import { NOTIFICATION_MODULE } from "../modules/notification"

const LOG = "[subscriber:dispense-decision]"

type DispenseDecisionData = {
  order_id: string
  decision: "approved" | "rejected" | "modified"
  pharmacist_id?: string
  reason?: string
}

/**
 * Fires when a pharmacist makes a dispensing decision on an Rx order.
 * Updates the pharmaOrder extension and notifies the warehouse team.
 */
export default async function dispenseDecisionHandler({
  event: { data },
  container,
}: SubscriberArgs<DispenseDecisionData>) {
  const { order_id, decision, pharmacist_id, reason } = data
  if (!order_id) return

  console.info(`${LOG} Order ${order_id}: decision=${decision} by ${pharmacist_id ?? "unknown"}`)

  try {
    // Update pharmaOrder extension status based on decision
    const pharmaOrderService = container.resolve(ORDERS_MODULE) as any
    const [extension] = await pharmaOrderService.listOrderExtensions(
      { order_id },
      { take: 1 }
    )

    if (!extension) {
      console.warn(`${LOG} No OrderExtension found for ${order_id}`)
      return
    }

    const statusMap: Record<string, string> = {
      approved: "ready_for_dispatch",
      rejected: "dispense_rejected",
      modified: "pending_customer_confirmation",
    }

    const newStatus = statusMap[decision] || extension.status
    const prevStatus = extension.status

    if (prevStatus !== newStatus) {
      await pharmaOrderService.updateOrderExtensions(extension.id, {
        status: newStatus,
        dispensed_by: pharmacist_id,
      })
      await pharmaOrderService.createOrderStateHistorys({
        order_id,
        from_status: prevStatus,
        to_status: newStatus,
        changed_by: pharmacist_id ?? "system:dispense-decision",
        reason: reason ?? `Dispense ${decision}`,
      })
      console.info(`${LOG} ${order_id}: ${prevStatus} → ${newStatus}`)
    }

    // Notify warehouse team if approved for dispatch
    if (decision === "approved") {
      try {
        const orderService = container.resolve(Modules.ORDER) as any
        const order = await orderService.retrieveOrder(order_id, {})
        const notifService = container.resolve(NOTIFICATION_MODULE) as any

        await notifService.createInternalNotifications({
          user_id: pharmacist_id ?? "system",
          role_scope: "warehouse",
          type: "dispatch_pending",
          title: `Order #${order.display_id ?? order_id} — Ready for Dispatch`,
          body: `Pharmacist approved dispensing. Order is ready for packing and shipment.`,
          reference_type: "order",
          reference_id: order_id,
        })
      } catch (err) {
        console.warn(`${LOG} Internal notification failed: ${(err as Error).message}`)
      }
    }
  } catch (err) {
    console.error(`${LOG} Failed for order ${order_id}: ${(err as Error).message}`)
  }
}

export const config: SubscriberConfig = { event: "dispense.decision_made" }
