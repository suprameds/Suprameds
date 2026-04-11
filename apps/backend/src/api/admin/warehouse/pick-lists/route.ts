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

    // Batch-fetch all orders at once instead of N individual retrieveOrder calls
    const orderIds = readyOrders.map((ext: any) => ext.order_id)
    const allOrders = await orderService.listOrders(
      { id: orderIds },
      { relations: ["items", "items.variant", "shipping_address"] }
    )
    const orderMap = new Map<string, any>()
    for (const o of allOrders) orderMap.set(o.id, o)

    // Collect all variant IDs and batch-fetch suggested batches
    const allVariantIds = new Set<string>()
    for (const o of allOrders) {
      for (const item of o.items || []) {
        if (item.variant_id) allVariantIds.add(item.variant_id)
      }
    }

    const batchesByVariant = new Map<string, any[]>()
    if (allVariantIds.size > 0) {
      const allBatches = await batchService.listBatches(
        { product_variant_id: [...allVariantIds], status: "active" },
        { take: null, order: { expiry_date: "ASC" } }
      )
      for (const b of allBatches) {
        const arr = batchesByVariant.get(b.product_variant_id) || []
        arr.push(b)
        batchesByVariant.set(b.product_variant_id, arr)
      }
    }

    const pickLists: any[] = []

    for (const ext of readyOrders) {
      try {
        const order = orderMap.get(ext.order_id)
        if (!order) continue

        const pickItems: any[] = []

        for (const item of order.items || []) {
          const variantId = item.variant_id
          if (!variantId) continue

          const variantBatches = batchesByVariant.get(variantId) || []
          const suggestedBatch = variantBatches[0]

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
