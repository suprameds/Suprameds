import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { INVENTORY_BATCH_MODULE } from "../../../../../../modules/inventoryBatch"
import { ORDERS_MODULE } from "../../../../../../modules/orders"
import { createLogger } from "../../../../../../lib/logger"

const logger = createLogger("admin:warehouse:pick-lists:allocate")

/**
 * POST /admin/warehouse/pick-lists/:orderId/allocate
 *
 * Manually triggers FEFO batch allocation for an order.
 * Used when auto-allocation didn't run (e.g., no Redis locally,
 * COD order, or the scheduled job missed it).
 *
 * Reuses the same FEFO logic as the order-placed subscriber
 * and auto-allocate job.
 */
export const POST = async (req: MedusaRequest, res: MedusaResponse) => {
  const { orderId } = req.params
  const actorId = (req as any).auth_context?.actor_id || "unknown"

  if (!orderId) {
    return res.status(400).json({ error: "orderId is required" })
  }

  try {
    const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)
    const batchService = req.scope.resolve(INVENTORY_BATCH_MODULE) as any
    const pharmaOrderService = req.scope.resolve(ORDERS_MODULE) as any

    // 1. Retrieve order with items via Query (avoids strategy error with relations)
    const { data: [order] } = await query.graph({
      entity: "order",
      fields: ["id", "items.*", "items.variant_id"],
      filters: { id: orderId },
    }) as any

    if (!order?.items?.length) {
      return res.status(400).json({ error: "Order has no items" })
    }

    // 2. Check existing deductions — skip items already allocated
    let existingDeductions: any[] = []
    try {
      existingDeductions = await batchService.listBatchDeductions(
        { order_id: orderId, deduction_type: "sale" },
        { take: null }
      )
    } catch { /* none yet */ }

    const allocatedByItem = new Map<string, number>()
    for (const d of existingDeductions) {
      const prev = allocatedByItem.get(d.order_line_item_id) || 0
      allocatedByItem.set(d.order_line_item_id, prev + Number(d.quantity))
    }

    // 3. FEFO allocation
    const MIN_SHELF_LIFE_DAYS = Number(process.env.BATCH_MIN_SHELF_LIFE_DAYS ?? 60)
    const mslCutoff = new Date()
    mslCutoff.setHours(0, 0, 0, 0)
    mslCutoff.setDate(mslCutoff.getDate() + MIN_SHELF_LIFE_DAYS)
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    let allAllocated = true
    let totalAllocated = 0

    for (const item of order.items) {
      const variantId = item.variant_id
      if (!variantId) continue

      const alreadyAllocated = allocatedByItem.get(item.id) || 0
      let remaining = Number(item.quantity) - alreadyAllocated
      if (remaining <= 0) continue

      const batches = await batchService.listBatches(
        { product_variant_id: variantId, status: "active" },
        { take: null, order: { expiry_date: "ASC" } }
      )

      // Prefer MSL-compliant batches first
      let eligible = (batches as any[]).filter((b: any) => {
        const exp = new Date(b.expiry_date)
        exp.setHours(0, 0, 0, 0)
        const avail = Number(b.available_quantity) - Number(b.reserved_quantity ?? 0)
        return exp >= mslCutoff && avail > 0
      })

      // Fall back to any non-expired batch
      if (!eligible.length) {
        eligible = (batches as any[]).filter((b: any) => {
          const exp = new Date(b.expiry_date)
          exp.setHours(0, 0, 0, 0)
          const avail = Number(b.available_quantity) - Number(b.reserved_quantity ?? 0)
          return exp >= today && avail > 0
        })
      }

      for (const batch of eligible) {
        if (remaining <= 0) break
        const avail = Number(batch.available_quantity) - Number(batch.reserved_quantity ?? 0)
        if (avail <= 0) continue
        const allocQty = Math.min(remaining, avail)
        const newAvail = Number(batch.available_quantity) - allocQty

        await batchService.updateBatches({
          id: batch.id,
          available_quantity: newAvail,
          version: Number(batch.version ?? 0) + 1,
          ...(newAvail === 0 ? { status: "depleted" } : {}),
        })

        await batchService.createBatchDeductions({
          batch_id: batch.id,
          order_line_item_id: item.id,
          order_id: orderId,
          quantity: allocQty,
          deduction_type: "sale",
          deducted_by: actorId,
        })

        // Audit log
        try {
          await batchService.createBatchAuditLogs({
            batch_id: batch.id,
            action: "manual_allocation",
            field_name: "available_quantity",
            old_value: String(batch.available_quantity),
            new_value: String(newAvail),
            actor_id: actorId,
            actor_type: "admin",
            order_id: orderId,
            reason: `Manual FEFO allocation triggered from admin`,
          })
        } catch { /* audit log is best-effort */ }

        remaining -= allocQty
        totalAllocated += allocQty
      }

      if (remaining > 0) allAllocated = false
    }

    // 4. Update order extension status if fully allocated
    if (allAllocated && totalAllocated > 0) {
      try {
        const [ext] = await pharmaOrderService.listOrderExtensions(
          { order_id: orderId },
          { take: 1 }
        )
        if (ext && ext.status !== "ready_for_dispatch" && ext.status !== "dispatched" && ext.status !== "delivered") {
          await pharmaOrderService.updateOrderExtensions({
            id: ext.id,
            status: "ready_for_dispatch",
          })
          await pharmaOrderService.createOrderStateHistorys({
            order_id: orderId,
            from_status: ext.status,
            to_status: "ready_for_dispatch",
            changed_by: `admin:${actorId}`,
            reason: "Manual FEFO allocation from admin panel",
          })
        }
      } catch (err: any) {
        logger.warn(`Failed to update order extension: ${err?.message}`)
      }
    }

    logger.info(
      `Manual allocation for order ${orderId}: ${totalAllocated} units allocated, fully_allocated=${allAllocated}, by ${actorId}`
    )

    res.json({
      success: true,
      total_allocated: totalAllocated,
      fully_allocated: allAllocated,
    })
  } catch (err) {
    logger.error(`Manual allocation failed for ${orderId}:`, (err as Error).message)
    res.status(500).json({ error: "Manual allocation failed" })
  }
}
