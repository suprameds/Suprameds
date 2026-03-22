import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { INVENTORY_BATCH_MODULE } from "../../../../../../modules/inventoryBatch"

/**
 * GET /admin/pharma/purchases/:id/lines
 * Lists all lines for a specific purchase order.
 */
export async function GET(req: MedusaRequest, res: MedusaResponse) {
  try {
    const batchService = req.scope.resolve(INVENTORY_BATCH_MODULE) as any
    const { id } = req.params

    const lines = await batchService.listPurchaseOrderLines(
      { purchase_order_id: id },
      {}
    )

    return res.json({ lines })
  } catch (err: any) {
    return res.status(400).json({ message: err?.message || "Failed to list PO lines" })
  }
}

/**
 * POST /admin/pharma/purchases/:id/lines
 * Adds a single line to an existing purchase order and recomputes totals.
 */
export async function POST(req: MedusaRequest, res: MedusaResponse) {
  const batchService = req.scope.resolve(INVENTORY_BATCH_MODULE) as any
  const { id } = req.params
  const body = req.body as Record<string, any>

  const required = [
    "product_id",
    "product_variant_id",
    "product_name",
    "lot_number",
    "expiry_date",
    "ordered_quantity",
    "purchase_price_paise",
  ]
  const missing = required.filter((f) => !body[f])
  if (missing.length) {
    return res.status(400).json({
      message: `Required: ${missing.join(", ")}`,
    })
  }

  try {
    const lineTotalPaise = Number(body.ordered_quantity) * Number(body.purchase_price_paise)

    const line = await batchService.createPurchaseOrderLines({
      purchase_order_id: id,
      product_id: body.product_id,
      product_variant_id: body.product_variant_id,
      product_name: body.product_name,
      lot_number: body.lot_number,
      expiry_date: body.expiry_date,
      manufactured_on: body.manufactured_on || null,
      ordered_quantity: Number(body.ordered_quantity),
      purchase_price_paise: Number(body.purchase_price_paise),
      mrp_paise: body.mrp_paise ? Number(body.mrp_paise) : null,
      line_total_paise: lineTotalPaise,
      metadata: body.metadata || null,
    })

    // Recompute PO totals
    const allLines = await batchService.listPurchaseOrderLines(
      { purchase_order_id: id },
      {}
    )
    const totals = computePOTotals(allLines)
    await batchService.updatePurchaseOrders({ id, ...totals })

    return res.status(201).json({ line })
  } catch (err: any) {
    return res.status(400).json({ message: err?.message || "Failed to add PO line" })
  }
}

/**
 * DELETE /admin/pharma/purchases/:id/lines
 * Removes specified lines from a PO and recomputes totals.
 * Body: { line_ids: string[] }
 */
export async function DELETE(req: MedusaRequest, res: MedusaResponse) {
  const batchService = req.scope.resolve(INVENTORY_BATCH_MODULE) as any
  const { id } = req.params
  const body = req.body as Record<string, any>

  if (!body.line_ids?.length) {
    return res.status(400).json({ message: "Required: line_ids (array of line IDs)" })
  }

  try {
    await batchService.deletePurchaseOrderLines(body.line_ids)

    // Recompute PO totals after deletion
    const allLines = await batchService.listPurchaseOrderLines(
      { purchase_order_id: id },
      {}
    )
    const totals = computePOTotals(allLines)
    await batchService.updatePurchaseOrders({ id, ...totals })

    return res.json({ success: true })
  } catch (err: any) {
    return res.status(400).json({ message: err?.message || "Failed to delete PO lines" })
  }
}

function computePOTotals(lines: any[]) {
  let totalQuantity = 0
  let totalCostPaise = 0

  for (const line of lines) {
    totalQuantity += Number(line.ordered_quantity)
    totalCostPaise += Number(line.line_total_paise)
  }

  return {
    total_items: lines.length,
    total_quantity: totalQuantity,
    total_cost_paise: totalCostPaise,
  }
}
