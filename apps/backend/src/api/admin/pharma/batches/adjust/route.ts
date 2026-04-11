import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { INVENTORY_BATCH_MODULE } from "../../../../../modules/inventoryBatch"

/**
 * POST /admin/pharma/batches/adjust
 *
 * Stock adjustment for a specific batch.
 * Supports: add (stock count correction, return restock) and reduce (damage, write-off, count correction).
 *
 * Body: {
 *   batch_id: string,
 *   adjustment_type: "add" | "reduce",
 *   quantity: number (positive),
 *   reason: string (mandatory for audit trail),
 *   price?: number (optional — at what price was this adjustment valued)
 * }
 */
export async function POST(req: MedusaRequest, res: MedusaResponse) {
  const logger = req.scope.resolve(ContainerRegistrationKeys.LOGGER) as any
  const batchService = req.scope.resolve(INVENTORY_BATCH_MODULE) as any
  const actorId = (req as any).auth_context?.actor_id || "unknown"

  const body = req.body as {
    batch_id: string
    adjustment_type: "add" | "reduce"
    quantity: number
    reason: string
    price?: number
  }

  if (!body.batch_id || !body.adjustment_type || !body.quantity || !body.reason) {
    return res.status(400).json({
      message: "Required: batch_id, adjustment_type (add/reduce), quantity, reason",
    })
  }

  if (!["add", "reduce"].includes(body.adjustment_type)) {
    return res.status(400).json({ message: "adjustment_type must be 'add' or 'reduce'" })
  }

  if (body.quantity <= 0) {
    return res.status(400).json({ message: "quantity must be positive" })
  }

  try {
    // Fetch current batch
    const batch = await batchService.retrieveBatch(body.batch_id)
    if (!batch) {
      return res.status(404).json({ message: "Batch not found" })
    }

    const oldQty = Number(batch.available_quantity)
    const adjustQty = Number(body.quantity)
    let newQty: number

    if (body.adjustment_type === "add") {
      newQty = oldQty + adjustQty
    } else {
      newQty = Math.max(0, oldQty - adjustQty)
      if (newQty === 0 && batch.status === "active") {
        // Auto-deplete if reducing to zero
        await batchService.updateBatches({
          id: batch.id,
          available_quantity: 0,
          status: "depleted",
        })

        // Audit: status change
        await batchService.createBatchAuditLogs({
          batch_id: batch.id,
          action: "status_changed",
          field_name: "status",
          old_value: batch.status,
          new_value: "depleted",
          actor_id: actorId,
          actor_type: "admin",
          reason: `Auto-depleted: ${body.reason}`,
        })

        // Audit: qty change
        await batchService.createBatchAuditLogs({
          batch_id: batch.id,
          action: "qty_adjusted",
          field_name: "available_quantity",
          old_value: String(oldQty),
          new_value: "0",
          actor_id: actorId,
          actor_type: "admin",
          reason: body.reason,
        })

        // Create deduction record for traceability
        await batchService.createBatchDeductions({
          batch_id: batch.id,
          quantity: adjustQty,
          deduction_type: "adjustment",
          deducted_by: actorId,
          metadata: { reason: body.reason, price: body.price },
        })

        return res.json({
          success: true,
          batch_id: batch.id,
          old_quantity: oldQty,
          new_quantity: 0,
          adjustment: -adjustQty,
          status: "depleted",
          message: `Reduced ${adjustQty} units. Batch depleted.`,
        })
      }
    }

    // Update batch quantity
    await batchService.updateBatches({
      id: batch.id,
      available_quantity: newQty,
    })

    // Audit log
    await batchService.createBatchAuditLogs({
      batch_id: batch.id,
      action: "qty_adjusted",
      field_name: "available_quantity",
      old_value: String(oldQty),
      new_value: String(newQty),
      actor_id: actorId,
      actor_type: "admin",
      reason: body.reason,
    })

    // For reductions, create a deduction record
    if (body.adjustment_type === "reduce") {
      await batchService.createBatchDeductions({
        batch_id: batch.id,
        quantity: adjustQty,
        deduction_type: "adjustment",
        deducted_by: actorId,
        metadata: { reason: body.reason, price: body.price },
      })
    }

    logger.info(
      `[batch-adjust] ${body.adjustment_type} ${adjustQty} on batch ${batch.lot_number}: ${oldQty} → ${newQty} (${body.reason})`
    )

    return res.json({
      success: true,
      batch_id: batch.id,
      old_quantity: oldQty,
      new_quantity: newQty,
      adjustment: body.adjustment_type === "add" ? adjustQty : -adjustQty,
      status: batch.status,
      message: `${body.adjustment_type === "add" ? "Added" : "Reduced"} ${adjustQty} units. New quantity: ${newQty}`,
    })
  } catch (err: any) {
    logger.error(`[batch-adjust] Failed: ${err?.message}`)
    return res.status(500).json({ message: err?.message || "Stock adjustment failed" })
  }
}
