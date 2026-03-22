import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { INVENTORY_BATCH_MODULE } from "../../../../../modules/inventoryBatch"

/**
 * GET /admin/pharma/batches/:id
 */
export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const batchService = req.scope.resolve(INVENTORY_BATCH_MODULE) as any
  const id = req.params.id

  try {
    const batch = await batchService.retrieveBatch(id, { relations: ["deductions"] })
    return res.json({ batch })
  } catch {
    return res.status(404).json({ message: "Batch not found" })
  }
}

/**
 * POST /admin/pharma/batches/:id
 * Updates batch fields (status, quantities, recall info, etc.)
 */
export async function POST(req: MedusaRequest, res: MedusaResponse) {
  const batchService = req.scope.resolve(INVENTORY_BATCH_MODULE) as any
  const id = req.params.id
  const body = req.body as Record<string, any>

  try {
    const batch = await batchService.updateBatches({
      id,
      ...body,
    })
    return res.json({ batch })
  } catch (err: any) {
    return res.status(400).json({ message: err?.message || "Failed to update batch" })
  }
}

/**
 * DELETE /admin/pharma/batches/:id
 * Soft-deletes a batch (sets status to depleted).
 */
export async function DELETE(req: MedusaRequest, res: MedusaResponse) {
  const batchService = req.scope.resolve(INVENTORY_BATCH_MODULE) as any
  const id = req.params.id

  try {
    await batchService.updateBatches({ id, status: "depleted" })
    return res.json({ success: true })
  } catch (err: any) {
    return res.status(400).json({ message: err?.message || "Failed to delete batch" })
  }
}
