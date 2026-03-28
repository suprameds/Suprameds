import type { SubscriberArgs, SubscriberConfig } from "@medusajs/framework"
import { Modules } from "@medusajs/framework/utils"
import { captureException } from "../lib/sentry"

const LOG = "[subscriber:order-edit-confirmed]"

type OrderEditConfirmedData = {
  order_id?: string
  actions?: any[]
}

/**
 * When an admin confirms an order edit, stamp the order metadata with
 * edit details so the storefront can show an "Order Modified" banner.
 */
export default async function handler({
  event: { data },
  container,
}: SubscriberArgs<OrderEditConfirmedData>) {
  const orderId = data?.order_id
  if (!orderId) {
    console.warn(`${LOG} Missing order_id`)
    return
  }

  try {
    const orderService = container.resolve(Modules.ORDER) as any
    const order = await orderService.retrieveOrder(orderId, {})

    const existingMeta = (order.metadata ?? {}) as Record<string, any>
    const editHistory: Array<{ at: string; summary: string }> =
      existingMeta.edit_history ?? []

    // Build a human-readable summary from the edit actions
    const actions = data.actions ?? []
    const parts: string[] = []
    for (const action of actions) {
      if (action.action === "ITEM_ADD") {
        const qty = action.details?.quantity ?? 1
        parts.push(`Added ${qty}× item`)
      } else if (action.action === "ITEM_UPDATE") {
        parts.push("Updated item quantity")
      } else if (action.action === "ITEM_REMOVE") {
        parts.push("Removed an item")
      }
    }

    const summary = parts.length
      ? parts.join(", ")
      : "Order was modified by pharmacy team"

    editHistory.push({
      at: new Date().toISOString(),
      summary,
    })

    await orderService.updateOrders(orderId, {
      metadata: {
        ...existingMeta,
        edited_at: new Date().toISOString(),
        edit_summary: summary,
        edit_history: editHistory,
      },
    })

    console.info(`${LOG} Stamped edit metadata on order ${orderId}: "${summary}"`)
  } catch (err) {
    console.error(`${LOG} Failed for ${orderId}: ${(err as Error).message}`)
    captureException(err, { subscriber: "order-edit-confirmed", orderId })
  }
}

export const config: SubscriberConfig = { event: "order-edit.confirmed" }
