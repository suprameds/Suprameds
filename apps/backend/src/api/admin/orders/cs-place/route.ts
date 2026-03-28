import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { Modules } from "@medusajs/framework/utils"
import { ORDERS_MODULE } from "../../../../modules/orders"
import { createLogger } from "../../../../lib/logger"

const logger = createLogger("admin:orders:cs-place")

/**
 * GET /admin/orders/cs-place
 * Lists orders placed by customer service (phone orders).
 */
export const GET = async (req: MedusaRequest, res: MedusaResponse) => {
  try {
    const pharmaOrderService = req.scope.resolve(ORDERS_MODULE) as any

    const limit = Number(req.query.limit) || 20
    const offset = Number(req.query.offset) || 0

    const [csOrders, count] = await Promise.all([
      pharmaOrderService.listCsPlacedOrders(
        {},
        { take: limit, skip: offset, order: { created_at: "DESC" } }
      ),
      pharmaOrderService.listCsPlacedOrders({}, { take: 0 }).then(
        (r: any[]) => r.length
      ),
    ])

    res.json({ cs_orders: csOrders, count, limit, offset })
  } catch (err) {
    logger.error(`GET failed:`, (err as Error).message)
    res.status(500).json({ error: "Failed to list CS-placed orders" })
  }
}

/**
 * POST /admin/orders/cs-place
 * Customer Service places an order on behalf of a customer (phone orders).
 * Body: { customer_phone, customer_name, items, shipping_address, notes }
 */
export const POST = async (req: MedusaRequest, res: MedusaResponse) => {
  const body = req.body as Record<string, any>

  if (!body.customer_phone || !body.items?.length) {
    return res.status(400).json({
      error: "customer_phone and items[] are required",
    })
  }

  try {
    const pharmaOrderService = req.scope.resolve(ORDERS_MODULE) as any
    const orderService = req.scope.resolve(Modules.ORDER) as any
    const authUser = (req as any).auth_context?.actor_id || "unknown"

    // Create the CS-placed order record
    const csOrder = await pharmaOrderService.createCsPlacedOrders({
      customer_phone: body.customer_phone,
      customer_name: body.customer_name || "",
      placed_by_user_id: authUser,
      items: body.items,
      shipping_address: body.shipping_address || null,
      notes: body.notes || "",
      status: "pending",
    })

    logger.info(
      `CS order created by ${authUser}: ${csOrder.id} for ${body.customer_phone}`
    )

    res.status(201).json({ cs_order: csOrder })
  } catch (err) {
    logger.error(`POST failed:`, (err as Error).message)
    res.status(500).json({ error: "Failed to create CS-placed order" })
  }
}
