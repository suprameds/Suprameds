import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { INVENTORY_BATCH_MODULE } from "../../../../../../modules/inventoryBatch"
import { createLogger } from "../../../../../../lib/logger"

const logger = createLogger("admin:warehouse:pick-lists:override")

/**
 * POST /admin/warehouse/pick-lists/:orderId/override
 *
 * Swaps a batch allocation for an order line item. This is used when
 * the warehouse operator needs to override the FEFO-suggested batch
 * (e.g., physical stock mismatch, damaged batch, pharmacist decision).
 *
 * Body: {
 *   line_item_id: string,
 *   old_deduction_id: string,
 *   new_batch_id: string,
 *   quantity: number
 * }
 *
 * Steps:
 * 1. Retrieve and validate the old deduction
 * 2. Restore stock to the old batch
 * 3. Deduct from the new batch
 * 4. Delete old deduction, create new one
 * 5. Log everything to BatchAuditLog
 */
export const POST = async (req: MedusaRequest, res: MedusaResponse) => {
  const { orderId } = req.params
  const body = req.body as Record<string, any>
  const actorId = (req as any).auth_context?.actor_id || "unknown"

  const { line_item_id, old_deduction_id, new_batch_id, quantity } = body

  if (!line_item_id || !old_deduction_id || !new_batch_id || !quantity) {
    return res.status(400).json({
      error:
        "Required: line_item_id, old_deduction_id, new_batch_id, quantity",
    })
  }

  try {
    const batchService = req.scope.resolve(INVENTORY_BATCH_MODULE) as any

    // 1. Retrieve old deduction
    let oldDeduction: any
    try {
      oldDeduction = await batchService.retrieveBatchDeduction(
        old_deduction_id
      )
    } catch {
      return res.status(404).json({ error: "Deduction not found" })
    }

    if (oldDeduction.order_id !== orderId) {
      return res
        .status(400)
        .json({ error: "Deduction does not belong to this order" })
    }

    const oldBatchId = oldDeduction.batch_id

    // 2. Restore stock to old batch
    const oldBatch = await batchService.retrieveBatch(oldBatchId)
    const restoredQty =
      Number(oldBatch.available_quantity) + Number(oldDeduction.quantity)
    const oldBatchUpdate: Record<string, any> = {
      id: oldBatchId,
      available_quantity: restoredQty,
      version: Number(oldBatch.version ?? 0) + 1,
    }
    if (oldBatch.status === "depleted") {
      oldBatchUpdate.status = "active"
    }
    await batchService.updateBatches(oldBatchUpdate)

    // 3. Deduct from new batch
    const newBatch = await batchService.retrieveBatch(new_batch_id)
    const effectiveAvail =
      Number(newBatch.available_quantity) -
      Number(newBatch.reserved_quantity ?? 0)

    if (effectiveAvail < quantity) {
      // Roll back: undo the old batch restore
      await batchService.updateBatches({
        id: oldBatchId,
        available_quantity: Number(oldBatch.available_quantity),
        version: Number(oldBatch.version ?? 0) + 2,
        status: oldBatch.status,
      })
      return res.status(400).json({
        error: `Insufficient stock in batch ${newBatch.lot_number}: need ${quantity}, have ${effectiveAvail}`,
      })
    }

    const newAvail = Number(newBatch.available_quantity) - quantity
    const newBatchUpdate: Record<string, any> = {
      id: new_batch_id,
      available_quantity: newAvail,
      version: Number(newBatch.version ?? 0) + 1,
    }
    if (newAvail === 0) newBatchUpdate.status = "depleted"
    await batchService.updateBatches(newBatchUpdate)

    // 4. Delete old deduction, create new one
    await batchService.deleteBatchDeductions(old_deduction_id)

    const newDeduction = await batchService.createBatchDeductions({
      batch_id: new_batch_id,
      order_line_item_id: line_item_id,
      order_id: orderId,
      quantity,
      deduction_type: "sale",
      deducted_by: actorId,
    })

    // 5. Audit logs
    try {
      // Log the reversal on old batch
      await batchService.createBatchAuditLogs({
        batch_id: oldBatchId,
        action: "deduction_reversed",
        field_name: "available_quantity",
        old_value: String(oldBatch.available_quantity),
        new_value: String(restoredQty),
        actor_id: actorId,
        actor_type: "admin",
        order_id: orderId,
        reason: `Fulfillment override: swapped to batch ${newBatch.lot_number}`,
      })

      // Log the new allocation
      await batchService.createBatchAuditLogs({
        batch_id: new_batch_id,
        action: "fulfillment_override",
        field_name: "available_quantity",
        old_value: String(newBatch.available_quantity),
        new_value: String(newAvail),
        actor_id: actorId,
        actor_type: "admin",
        order_id: orderId,
        fulfillment_id: null,
        reason: `Fulfillment override: replaced batch ${oldBatch.lot_number} for order ${orderId}`,
      })
    } catch (err: any) {
      logger.warn(`Audit log write failed: ${err?.message}`)
    }

    logger.info(
      `Override for order ${orderId}: ${oldBatch.lot_number} → ${newBatch.lot_number} (${quantity} units) by ${actorId}`
    )

    res.json({
      success: true,
      old_batch: { id: oldBatchId, lot_number: oldBatch.lot_number },
      new_batch: { id: new_batch_id, lot_number: newBatch.lot_number },
      new_deduction_id: newDeduction.id,
      quantity,
    })
  } catch (err) {
    logger.error(`Override failed:`, (err as Error).message)
    res.status(500).json({ error: "Batch override failed" })
  }
}
