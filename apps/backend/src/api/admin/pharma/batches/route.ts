import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { INVENTORY_BATCH_MODULE } from "../../../../modules/inventoryBatch"

/**
 * GET /admin/pharma/batches?product_id=xxx&variant_id=xxx&status=active
 * Lists batches, optionally filtered by product, variant, or status.
 */
export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const batchService = req.scope.resolve(INVENTORY_BATCH_MODULE) as any
  const filters: Record<string, any> = {}

  if (req.query.product_id) filters.product_id = req.query.product_id
  if (req.query.variant_id) filters.product_variant_id = req.query.variant_id
  if (req.query.status) filters.status = req.query.status

  const batches = await batchService.listBatches(filters, {
    order: { expiry_date: "ASC" },
    relations: ["deductions"],
  })

  return res.json({ batches })
}

/**
 * POST /admin/pharma/batches
 * Creates a new batch (GRN / stock receipt) with audit trail.
 */
export async function POST(req: MedusaRequest, res: MedusaResponse) {
  const batchService = req.scope.resolve(INVENTORY_BATCH_MODULE) as any
  const body = req.body as Record<string, any>
  const actorId = (req as any).auth_context?.actor_id || "unknown"

  if (
    !body.product_variant_id ||
    !body.product_id ||
    !body.lot_number ||
    !body.expiry_date ||
    !body.received_quantity
  ) {
    return res.status(400).json({
      message:
        "Required: product_variant_id, product_id, lot_number, expiry_date, received_quantity",
    })
  }

  try {
    const batch = await batchService.createBatches({
      product_variant_id: body.product_variant_id,
      product_id: body.product_id,
      lot_number: body.lot_number,
      manufactured_on: body.manufactured_on || null,
      expiry_date: body.expiry_date,
      received_quantity: Number(body.received_quantity),
      available_quantity: Number(body.received_quantity),
      reserved_quantity: 0,
      batch_mrp_paise: body.batch_mrp_paise
        ? Number(body.batch_mrp_paise)
        : null,
      purchase_price_paise: body.purchase_price_paise
        ? Number(body.purchase_price_paise)
        : null,
      location_id: body.location_id || null,
      supplier_name: body.supplier_name || null,
      purchase_order_ref: body.purchase_order_ref || null,
      grn_number: body.grn_number || null,
      received_on: body.received_on || new Date().toISOString(),
      status: body.status || "active",
      metadata: body.metadata || null,
    })

    // Audit: log batch creation
    try {
      await batchService.createBatchAuditLogs({
        batch_id: batch.id,
        action: "created",
        field_name: null,
        old_value: null,
        new_value: `lot=${body.lot_number} qty=${body.received_quantity} exp=${body.expiry_date}`,
        actor_id: actorId,
        actor_type: "admin",
        reason: body._reason || "Manual batch creation via admin",
      })
    } catch {
      // Best-effort audit
    }

    return res.status(201).json({ batch })
  } catch (err: any) {
    return res
      .status(400)
      .json({ message: err?.message || "Failed to create batch" })
  }
}
