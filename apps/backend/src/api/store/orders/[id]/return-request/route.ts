import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { Modules } from "@medusajs/framework/utils"
import { createLogger } from "../../../../../lib/logger"

const logger = createLogger("store:orders:return-request")

type ReturnItem = {
  line_item_id: string
  quantity: number
  reason?: string
}

/**
 * POST /store/orders/:id/return-request
 * Authenticated customer endpoint to request a return for an order.
 * Body: { items: [{ line_item_id, quantity, reason? }] }
 *
 * Validates the order belongs to the requesting customer,
 * then emits order.return_requested for downstream processing.
 */
export async function POST(req: MedusaRequest, res: MedusaResponse) {
  const { id: orderId } = req.params
  const body = req.body as { items: ReturnItem[] }
  const customerId = (req as any).auth_context?.actor_id

  if (!customerId) {
    return res.status(401).json({ message: "Authentication required" })
  }

  if (!body.items || !Array.isArray(body.items) || body.items.length === 0) {
    return res.status(400).json({ message: "items array is required and must not be empty" })
  }

  // Validate each item has required fields
  for (const item of body.items) {
    if (!item.line_item_id) {
      return res.status(400).json({ message: "Each item must have a line_item_id" })
    }
    if (!item.quantity || item.quantity < 1) {
      return res.status(400).json({ message: "Each item must have a quantity of at least 1" })
    }
  }

  try {
    // Validate order belongs to this customer
    const orderService = req.scope.resolve(Modules.ORDER) as any
    let order: any
    try {
      order = await orderService.retrieveOrder(orderId, {
        select: ["id", "customer_id", "status"],
      })
    } catch {
      return res.status(404).json({ message: "Order not found" })
    }

    if (!order) {
      return res.status(404).json({ message: "Order not found" })
    }

    if (order.customer_id !== customerId) {
      return res.status(403).json({ message: "You are not authorized to request a return for this order" })
    }

    // Only delivered orders can have return requests
    if (order.status && !["delivered", "completed"].includes(order.status)) {
      return res.status(400).json({
        message: `Return requests can only be raised for delivered orders (current status: ${order.status})`,
      })
    }

    // Emit the return_requested event for warehouse and refund processing
    const eventBus = req.scope.resolve(Modules.EVENT_BUS) as any
    await eventBus.emit({
      name: "order.return_requested",
      data: {
        order_id: orderId,
        customer_id: customerId,
        items: body.items,
        return_id: `return-${orderId}-${Date.now()}`,
      },
    })

    return res.status(200).json({ message: "Return request received" })
  } catch (err) {
    const message = (err as Error).message
    logger.error(`POST error for order ${orderId}:`, message)
    return res.status(500).json({ message: "Failed to process return request" })
  }
}
