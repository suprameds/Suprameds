import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { INVENTORY_BATCH_MODULE } from "../../../../../modules/inventoryBatch"

/**
 * GET /admin/pharma/purchases/:id
 * Retrieves a single purchase order with all lines.
 */
export async function GET(req: MedusaRequest, res: MedusaResponse) {
  try {
    const batchService = req.scope.resolve(INVENTORY_BATCH_MODULE) as any
    const { id } = req.params

    const purchase_order = await batchService.retrievePurchaseOrder(id, {
      relations: ["lines"],
    })

    return res.json({ purchase_order })
  } catch (err: any) {
    return res.status(400).json({ message: err?.message || "Purchase order not found" })
  }
}

/**
 * POST /admin/pharma/purchases/:id
 * Updates PO fields and optionally appends new lines.
 */
export async function POST(req: MedusaRequest, res: MedusaResponse) {
  const batchService = req.scope.resolve(INVENTORY_BATCH_MODULE) as any
  const { id } = req.params
  const body = req.body as Record<string, any>

  try {
    // Build update payload from allowed fields
    const updateData: Record<string, any> = { id }
    const allowedFields = [
      "status",
      "supplier_name",
      "supplier_contact",
      "supplier_invoice_number",
      "expected_delivery_date",
      "grn_number",
      "location_id",
      "notes",
    ]
    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        updateData[field] = body[field]
      }
    }

    await batchService.updatePurchaseOrders(updateData)

    // Append new lines if provided
    const linesInput = body.lines as any[] | undefined
    if (linesInput?.length) {
      for (const line of linesInput) {
        const lineTotalPaise = Number(line.ordered_quantity) * Number(line.purchase_price_paise)

        await batchService.createPurchaseOrderLines({
          purchase_order_id: id,
          product_id: line.product_id,
          product_variant_id: line.product_variant_id,
          product_name: line.product_name,
          lot_number: line.lot_number,
          expiry_date: line.expiry_date,
          manufactured_on: line.manufactured_on || null,
          ordered_quantity: Number(line.ordered_quantity),
          purchase_price_paise: Number(line.purchase_price_paise),
          mrp_paise: line.mrp_paise ? Number(line.mrp_paise) : null,
          line_total_paise: lineTotalPaise,
          metadata: line.metadata || null,
        })
      }
    }

    // Recompute PO totals
    const allLines = await batchService.listPurchaseOrderLines(
      { purchase_order_id: id },
      {}
    )
    const totals = computePOTotals(allLines)
    await batchService.updatePurchaseOrders({ id, ...totals })

    // Re-fetch complete PO
    const result = await batchService.retrievePurchaseOrder(id, {
      relations: ["lines"],
    })

    return res.json({ purchase_order: result })
  } catch (err: any) {
    return res.status(400).json({ message: err?.message || "Failed to update purchase order" })
  }
}

/**
 * DELETE /admin/pharma/purchases/:id
 * Soft-cancels a PO by setting status to "cancelled".
 */
export async function DELETE(req: MedusaRequest, res: MedusaResponse) {
  try {
    const batchService = req.scope.resolve(INVENTORY_BATCH_MODULE) as any
    const { id } = req.params

    await batchService.updatePurchaseOrders({
      id,
      status: "cancelled",
    })

    return res.json({ success: true })
  } catch (err: any) {
    return res.status(400).json({ message: err?.message || "Failed to cancel purchase order" })
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
