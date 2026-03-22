import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { INVENTORY_BATCH_MODULE } from "../../../../modules/inventoryBatch"

/**
 * GET /admin/pharma/purchases?status=draft&supplier_name=xyz
 * Lists purchase orders with optional filters.
 */
export async function GET(req: MedusaRequest, res: MedusaResponse) {
  try {
    const batchService = req.scope.resolve(INVENTORY_BATCH_MODULE) as any
    const filters: Record<string, any> = {}

    if (req.query.status) filters.status = req.query.status
    if (req.query.supplier_name) {
      filters.supplier_name = { $like: `%${req.query.supplier_name}%` }
    }

    const purchase_orders = await batchService.listPurchaseOrders(filters, {
      order: { order_date: "DESC" },
      relations: ["lines"],
    })

    return res.json({ purchase_orders })
  } catch (err: any) {
    return res.status(400).json({ message: err?.message || "Failed to list purchase orders" })
  }
}

/**
 * POST /admin/pharma/purchases
 * Creates a new purchase order, optionally with lines.
 */
export async function POST(req: MedusaRequest, res: MedusaResponse) {
  const batchService = req.scope.resolve(INVENTORY_BATCH_MODULE) as any
  const body = req.body as Record<string, any>

  if (!body.po_number || !body.supplier_name || !body.order_date) {
    return res.status(400).json({
      message: "Required: po_number, supplier_name, order_date",
    })
  }

  try {
    // Create the purchase order (without lines first)
    const po = await batchService.createPurchaseOrders({
      po_number: body.po_number,
      supplier_name: body.supplier_name,
      supplier_contact: body.supplier_contact || null,
      supplier_invoice_number: body.supplier_invoice_number || null,
      order_date: body.order_date,
      expected_delivery_date: body.expected_delivery_date || null,
      grn_number: body.grn_number || null,
      location_id: body.location_id || null,
      notes: body.notes || null,
      created_by: body.created_by || null,
      status: "draft",
      total_items: 0,
      total_quantity: 0,
      total_cost_paise: 0,
    })

    // Create lines if provided
    const linesInput = body.lines as any[] | undefined
    if (linesInput?.length) {
      for (const line of linesInput) {
        const lineTotalPaise = Number(line.ordered_quantity) * Number(line.purchase_price_paise)

        await batchService.createPurchaseOrderLines({
          purchase_order_id: po.id,
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

      // Recompute PO totals
      const allLines = await batchService.listPurchaseOrderLines(
        { purchase_order_id: po.id },
        {}
      )
      const totals = computePOTotals(allLines)

      await batchService.updatePurchaseOrders({
        id: po.id,
        ...totals,
      })
    }

    // Re-fetch with lines to return complete object
    const result = await batchService.retrievePurchaseOrder(po.id, {
      relations: ["lines"],
    })

    return res.status(201).json({ purchase_order: result })
  } catch (err: any) {
    return res.status(400).json({ message: err?.message || "Failed to create purchase order" })
  }
}

/** Compute aggregate totals from an array of PO lines. */
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
