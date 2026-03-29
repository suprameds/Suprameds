import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { INVENTORY_BATCH_MODULE } from "../../../../../modules/inventoryBatch"
import { createLogger } from "../../../../../lib/logger"

const logger = createLogger("admin:warehouse:pick-lists")

/**
 * GET /admin/warehouse/pick-lists/:orderId
 *
 * Returns the actual batch allocation for a specific order — built from
 * BatchDeduction records created during FEFO allocation. This is what
 * warehouse staff use during packing to know exactly which lot/batch
 * to pick from which shelf.
 *
 * Response shape:
 * {
 *   order_id, display_id, customer_name, shipping_address,
 *   items: [{
 *     line_item_id, product_title, variant_sku, quantity_ordered,
 *     batches: [{
 *       batch_id, lot_number, expiry_date, quantity_allocated,
 *       shelf_location, available_after_pick
 *     }],
 *     quantity_unallocated
 *   }]
 * }
 */
export const GET = async (req: MedusaRequest, res: MedusaResponse) => {
  const { orderId } = req.params

  if (!orderId) {
    return res.status(400).json({ error: "orderId is required" })
  }

  try {
    const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)
    const batchService = req.scope.resolve(INVENTORY_BATCH_MODULE) as any

    const { data: [order] } = await query.graph({
      entity: "order",
      fields: ["id", "display_id", "items.*", "items.variant_id", "items.variant.sku", "shipping_address.*"],
      filters: { id: orderId },
    }) as any

    if (!order) {
      return res.status(404).json({ error: "Order not found" })
    }

    // Fetch all sale deductions for this order
    let deductions: any[] = []
    try {
      deductions = await batchService.listBatchDeductions(
        { order_id: orderId, deduction_type: "sale" },
        { take: null }
      )
    } catch {
      // No deductions yet
    }

    // Group deductions by line item
    const deductionsByItem = new Map<string, any[]>()
    for (const d of deductions) {
      const key = d.order_line_item_id
      if (!deductionsByItem.has(key)) deductionsByItem.set(key, [])
      deductionsByItem.get(key)!.push(d)
    }

    // Hydrate batch details into a cache to avoid N+1 queries
    const batchIds = [...new Set(deductions.map((d) => d.batch_id))]
    const batchCache = new Map<string, any>()
    for (const batchId of batchIds) {
      try {
        const batch = await batchService.retrieveBatch(batchId)
        if (batch) batchCache.set(batchId, batch)
      } catch {
        // Batch may have been deleted
      }
    }

    // Build the pick list
    const items = (order.items || []).map((item: any) => {
      const itemDeductions = deductionsByItem.get(item.id) || []
      const totalAllocated = itemDeductions.reduce(
        (sum: number, d: any) => sum + Number(d.quantity),
        0
      )

      return {
        line_item_id: item.id,
        product_title: item.title,
        variant_sku: item.variant?.sku || null,
        variant_id: item.variant_id,
        product_id: item.product_id,
        quantity_ordered: item.quantity,
        quantity_unallocated: Math.max(0, item.quantity - totalAllocated),
        batches: itemDeductions.map((d: any) => {
          const batch = batchCache.get(d.batch_id)
          return {
            deduction_id: d.id,
            batch_id: d.batch_id,
            lot_number: batch?.lot_number || "UNKNOWN",
            expiry_date: batch?.expiry_date
              ? new Date(batch.expiry_date).toISOString().slice(0, 10)
              : null,
            quantity_allocated: d.quantity,
            shelf_location: batch?.location_id || null,
            supplier: batch?.supplier_name || null,
            available_after_pick: batch
              ? Number(batch.available_quantity)
              : null,
          }
        }),
      }
    })

    const shippingAddr = order.shipping_address
    const customerName = shippingAddr
      ? `${shippingAddr.first_name || ""} ${shippingAddr.last_name || ""}`.trim()
      : "Unknown"

    res.json({
      order_id: orderId,
      display_id: order.display_id,
      customer_name: customerName,
      shipping_address: shippingAddr
        ? {
            line1: shippingAddr.address_1,
            line2: shippingAddr.address_2,
            city: shippingAddr.city,
            province: shippingAddr.province,
            postal_code: shippingAddr.postal_code,
            country: shippingAddr.country_code,
          }
        : null,
      items,
      fully_allocated: items.every((i: any) => i.quantity_unallocated === 0),
      total_deductions: deductions.length,
    })
  } catch (err) {
    logger.error(`GET failed for ${orderId}:`, (err as Error).message)
    res.status(500).json({ error: "Failed to generate pick list" })
  }
}
