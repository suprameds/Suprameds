import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { INVENTORY_BATCH_MODULE } from "../../../../../../modules/inventoryBatch"
import { recallBatchWorkflow } from "../../../../../../workflows/inventory/recall-batch"

/**
 * POST /admin/pharma/batches/:id/recall
 *
 * Triggers a full batch recall — quarantines the batch, flags affected orders,
 * sends internal notifications, and emits a batch.recalled event.
 *
 * Body: { recall_reason: string, recall_authority: string }
 */
export async function POST(req: MedusaRequest, res: MedusaResponse) {
  const batchId = req.params.id
  const body = req.body as Record<string, any>

  if (!body.recall_reason || !body.recall_authority) {
    return res.status(400).json({
      message: "Required fields: recall_reason, recall_authority",
    })
  }

  // auth_identity_id is set by Medusa's admin auth middleware
  const userId =
    (req as any).auth_context?.actor_id ??
    (req as any).user?.id ??
    "unknown"

  try {
    const { result } = await recallBatchWorkflow(req.scope).run({
      input: {
        batch_id: batchId,
        recall_reason: body.recall_reason,
        recall_authority: body.recall_authority,
        recalled_by_user_id: userId,
      },
    })

    return res.status(200).json({
      success: true,
      recall: result,
    })
  } catch (err: any) {
    const status = err.message?.includes("not found") ? 404 : 400
    return res.status(status).json({
      success: false,
      message: err.message || "Recall workflow failed",
    })
  }
}

/**
 * GET /admin/pharma/batches/:id/recall
 *
 * Returns recall details for a specific batch.
 */
export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const batchService = req.scope.resolve(INVENTORY_BATCH_MODULE) as any
  const batchId = req.params.id

  try {
    const batch = await batchService.retrieveBatch(batchId, {
      relations: ["deductions"],
    })

    if (batch.status !== "recalled") {
      return res.status(200).json({
        recalled: false,
        batch_id: batchId,
        current_status: batch.status,
      })
    }

    // Collect unique affected order IDs from deductions
    const affectedOrderIds = [
      ...new Set(
        (batch.deductions || []).map((d: any) => d.order_id).filter(Boolean)
      ),
    ]

    return res.json({
      recalled: true,
      batch_id: batch.id,
      lot_number: batch.lot_number,
      product_variant_id: batch.product_variant_id,
      product_id: batch.product_id,
      recall_reason: batch.recall_reason,
      recalled_on: batch.recalled_on,
      recall_authority: batch.metadata?.recall_authority ?? null,
      recalled_by: batch.metadata?.recalled_by ?? null,
      previous_status: batch.metadata?.previous_status ?? null,
      previous_available_quantity: batch.metadata?.previous_available_quantity ?? null,
      affected_order_count: affectedOrderIds.length,
      affected_order_ids: affectedOrderIds,
    })
  } catch {
    return res.status(404).json({ message: "Batch not found" })
  }
}
