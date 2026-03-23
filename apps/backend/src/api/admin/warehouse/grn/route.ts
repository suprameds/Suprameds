import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { WAREHOUSE_MODULE } from "../../../../modules/warehouse"

const LOG = "[admin:warehouse-grn]"

/**
 * GET /admin/warehouse/grn
 * Lists goods receipt notes with optional filters.
 * Query params: limit, offset, status, supplier_name
 */
export const GET = async (req: MedusaRequest, res: MedusaResponse) => {
  try {
    const warehouseService = req.scope.resolve(WAREHOUSE_MODULE) as any

    const limit = Number(req.query.limit) || 20
    const offset = Number(req.query.offset) || 0
    const filters: Record<string, any> = {}

    if (req.query.status) {
      filters.status = req.query.status
    }
    if (req.query.supplier_name) {
      filters.supplier_name = req.query.supplier_name
    }

    const grns = await warehouseService.listGrnRecords(
      filters,
      {
        take: limit,
        skip: offset,
        order: { created_at: "DESC" },
      }
    )

    res.json({ grn_records: grns, count: grns.length, limit, offset })
  } catch (err) {
    console.error(`${LOG} GET failed:`, (err as Error).message)
    res.status(500).json({ error: "Failed to list GRN records" })
  }
}

/**
 * POST /admin/warehouse/grn
 * Creates a new goods receipt note.
 * Body: { grn_number, supplier_name, supplier_invoice_no?,
 *         received_by, items: [{ product_id, product_variant_id,
 *         lot_number, expiry_date, quantity, batch_mrp_paise?,
 *         purchase_price_paise?, manufactured_on? }] }
 */
export const POST = async (req: MedusaRequest, res: MedusaResponse) => {
  const body = req.body as Record<string, any>

  if (!body.grn_number || !body.supplier_name || !body.items?.length) {
    return res.status(400).json({
      error: "grn_number, supplier_name, and items[] are required",
    })
  }

  // Validate each item has required fields
  for (const [i, item] of body.items.entries()) {
    if (!item.product_variant_id || !item.lot_number || !item.expiry_date || !item.quantity) {
      return res.status(400).json({
        error: `Item ${i}: product_variant_id, lot_number, expiry_date, and quantity are required`,
      })
    }
  }

  try {
    const warehouseService = req.scope.resolve(WAREHOUSE_MODULE) as any
    const actorId = (req as any).auth_context?.actor_id || "unknown"

    const grn = await warehouseService.createGrnRecords({
      grn_number: body.grn_number,
      supplier_name: body.supplier_name,
      supplier_invoice_no: body.supplier_invoice_no || null,
      received_by: body.received_by || actorId,
      received_at: new Date().toISOString(),
      status: "pending_qc",
      items: body.items,
    })

    console.info(`${LOG} GRN created: ${grn.id} (${body.grn_number}) by ${actorId}`)
    res.status(201).json({ grn_record: grn })
  } catch (err) {
    console.error(`${LOG} POST failed:`, (err as Error).message)
    res.status(500).json({ error: "Failed to create GRN" })
  }
}
