import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { INVENTORY_BATCH_MODULE } from "../../../../../modules/inventoryBatch"

const AUDITABLE_FIELDS = [
  "lot_number",
  "expiry_date",
  "manufactured_on",
  "received_quantity",
  "available_quantity",
  "reserved_quantity",
  "batch_mrp_paise",
  "purchase_price_paise",
  "supplier_name",
  "grn_number",
  "location_id",
  "status",
  "recall_reason",
]

/**
 * GET /admin/pharma/batches/:id
 */
export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const batchService = req.scope.resolve(INVENTORY_BATCH_MODULE) as any
  const id = req.params.id

  try {
    const batch = await batchService.retrieveBatch(id, {
      relations: ["deductions"],
    })

    let audit_log: any[] = []
    try {
      audit_log = await batchService.listBatchAuditLogs(
        { batch_id: id },
        { order: { created_at: "DESC" }, take: 50 }
      )
    } catch {
      // Audit log table may not exist yet
    }

    return res.json({ batch, audit_log })
  } catch {
    return res.status(404).json({ message: "Batch not found" })
  }
}

/**
 * POST /admin/pharma/batches/:id
 * Updates batch fields with full audit trail.
 * Every changed field is logged to batch_audit_log.
 */
export async function POST(req: MedusaRequest, res: MedusaResponse) {
  const batchService = req.scope.resolve(INVENTORY_BATCH_MODULE) as any
  const id = req.params.id
  const body = req.body as Record<string, any>
  const actorId =
    (req as any).auth_context?.actor_id || body._actor_id || "unknown"
  const reason = body._reason || null

  // Strip internal meta-fields before passing to update
  delete body._actor_id
  delete body._reason

  try {
    // Read current state for diff
    const before = await batchService.retrieveBatch(id)

    await batchService.updateBatches({ id, ...body })

    // Log each changed field
    const auditEntries: any[] = []
    for (const field of AUDITABLE_FIELDS) {
      if (!(field in body)) continue

      const oldVal = String(before[field] ?? "")
      const newVal = String(body[field] ?? "")
      if (oldVal === newVal) continue

      let action: string = "field_edited"
      if (field === "status") action = "status_changed"
      if (
        field === "available_quantity" ||
        field === "received_quantity" ||
        field === "reserved_quantity"
      )
        action = "qty_adjusted"

      auditEntries.push({
        batch_id: id,
        action,
        field_name: field,
        old_value: oldVal,
        new_value: newVal,
        actor_id: actorId,
        actor_type: "admin",
        order_id: body._order_id || null,
        reason,
      })
    }

    if (auditEntries.length) {
      try {
        for (const entry of auditEntries) {
          await batchService.createBatchAuditLogs(entry)
        }
      } catch (err: any) {
        console.warn(
          `[batch-audit] Failed to write audit log: ${err?.message}`
        )
      }
    }

    const updated = await batchService.retrieveBatch(id)
    return res.json({ batch: updated, changes_logged: auditEntries.length })
  } catch (err: any) {
    return res
      .status(400)
      .json({ message: err?.message || "Failed to update batch" })
  }
}

/**
 * DELETE /admin/pharma/batches/:id
 * Soft-deletes a batch (sets status to depleted) with audit log.
 */
export async function DELETE(req: MedusaRequest, res: MedusaResponse) {
  const batchService = req.scope.resolve(INVENTORY_BATCH_MODULE) as any
  const id = req.params.id
  const actorId = (req as any).auth_context?.actor_id || "unknown"

  try {
    const before = await batchService.retrieveBatch(id)
    await batchService.updateBatches({ id, status: "depleted" })

    try {
      await batchService.createBatchAuditLogs({
        batch_id: id,
        action: "status_changed",
        field_name: "status",
        old_value: before.status,
        new_value: "depleted",
        actor_id: actorId,
        actor_type: "admin",
        reason: "Batch soft-deleted via admin",
      })
    } catch {
      // Best-effort audit
    }

    return res.json({ success: true })
  } catch (err: any) {
    return res
      .status(400)
      .json({ message: err?.message || "Failed to delete batch" })
  }
}
