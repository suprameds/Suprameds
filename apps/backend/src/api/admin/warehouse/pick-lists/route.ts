import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { Modules } from "@medusajs/framework/utils"
import { ORDERS_MODULE } from "../../../../modules/orders"
import { INVENTORY_BATCH_MODULE } from "../../../../modules/inventoryBatch"
import { createLogger } from "../../../../lib/logger"

const logger = createLogger("admin:warehouse:pick-lists")

/**
 * GET /admin/warehouse/pick-lists
 * Generates a pick list for orders ready for dispatch.
 * Groups items by warehouse location/batch for efficient picking.
 * Query params: limit, offset
 */
export const GET = async (req: MedusaRequest, res: MedusaResponse) => {
  try {
    const pharmaOrderService = req.scope.resolve(ORDERS_MODULE) as any
    const orderService = req.scope.resolve(Modules.ORDER) as any
    const batchService = req.scope.resolve(INVENTORY_BATCH_MODULE) as any

    const limit = Number(req.query.limit) || 20

    // Fetch orders ready for dispatch
    const readyOrders = await pharmaOrderService.listOrderExtensions(
      { status: "ready_for_dispatch" },
      { take: limit, order: { created_at: "ASC" } }
    )

    if (!readyOrders?.length) {
      return res.json({ pick_lists: [], count: 0 })
    }

    const pickLists: any[] = []

    for (const ext of readyOrders) {
      try {
        const order = await orderService.retrieveOrder(ext.order_id, {
          relations: ["items", "items.variant", "shipping_address"],
        })

        const pickItems: any[] = []

        for (const item of order.items || []) {
          const variantId = item.variant_id
          if (!variantId) continue

          // Find allocated batch for this item (FEFO)
          const batches = await batchService.listBatches(
            {
              product_variant_id: variantId,
              status: "active",
            },
            { take: 5, order: { expiry_date: "ASC" } }
          )

          const suggestedBatch = batches?.[0]

          pickItems.push({
            product_title: item.title,
            variant_id: variantId,
            quantity: item.quantity,
            suggested_batch: suggestedBatch
              ? {
                  batch_id: suggestedBatch.id,
                  lot_number: suggestedBatch.lot_number,
                  expiry_date: suggestedBatch.expiry_date,
                  available: suggestedBatch.available_quantity,
                }
              : null,
          })
        }

        pickLists.push({
          order_id: ext.order_id,
          display_id: order.display_id,
          customer_name: `${order.shipping_address?.first_name || ""} ${order.shipping_address?.last_name || ""}`.trim(),
          shipping_city: order.shipping_address?.city || "",
          items: pickItems,
        })
      } catch (err) {
        logger.warn(`Skipping order ${ext.order_id}: ${(err as Error).message}`)
      }
    }

    res.json({ pick_lists: pickLists, count: pickLists.length })
  } catch (err) {
    logger.error(`GET failed:`, (err as Error).message)
    res.status(500).json({ error: "Failed to generate pick lists" })
  }
}

/**
 * POST /admin/warehouse/pick-lists
 * Marks a pick list as completed (items picked and packed).
 * Body: { order_id, picked_by, items: [{ variant_id, batch_id, quantity }] }
 */
export const POST = async (req: MedusaRequest, res: MedusaResponse) => {
  const body = req.body as Record<string, any>

  if (!body.order_id || !body.items?.length) {
    return res.status(400).json({
      error: "order_id and items[] are required",
    })
  }

  try {
    const batchService = req.scope.resolve(INVENTORY_BATCH_MODULE) as any
    const pharmaOrderService = req.scope.resolve(ORDERS_MODULE) as any
    const actorId = (req as any).auth_context?.actor_id || body.picked_by || "unknown"

    // Record batch deductions for each picked item
    for (const item of body.items) {
      if (!item.batch_id || !item.quantity) continue

      await batchService.createBatchDeductions({
        batch_id: item.batch_id,
        order_id: body.order_id,
        order_line_item_id: item.order_line_item_id || null,
        product_variant_id: item.variant_id,
        quantity: item.quantity,
        deducted_by: actorId,
        deduction_type: "sale",
      })
    }

    // Update order status to packed
    const [ext] = await pharmaOrderService.listOrderExtensions(
      { order_id: body.order_id },
      { take: 1 }
    )

    if (ext) {
      const prevStatus = ext.status
      await pharmaOrderService.updateOrderExtensions({
        id: ext.id,
        status: "packed",
      })
      await pharmaOrderService.createOrderStateHistorys({
        order_id: body.order_id,
        from_status: prevStatus,
        to_status: "packed",
        changed_by: actorId,
        reason: "Pick list completed, items packed",
      })
    }

    logger.info(`Pick completed for order ${body.order_id} by ${actorId}`)
    res.status(200).json({ success: true, order_id: body.order_id, status: "packed" })
  } catch (err) {
    logger.error(`POST failed:`, (err as Error).message)
    res.status(500).json({ error: "Failed to complete pick list" })
  }
}
