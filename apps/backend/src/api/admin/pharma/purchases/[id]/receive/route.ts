import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import { INVENTORY_BATCH_MODULE } from "../../../../../../modules/inventoryBatch"
import {
  checkMrpConflicts,
  syncProductMrpFromBatches,
} from "../../../../../../utils/mrp-validation"

interface LineOverride {
  line_id: string
  received_quantity?: number
  line_status?: "received" | "partial" | "rejected"
  rejection_reason?: string
}

/**
 * POST /admin/pharma/purchases/:id/receive
 * Receives goods for a PO:
 *  1. Creates Batch records (lot tracking)
 *  2. Updates Medusa Inventory stock levels
 *  3. Updates PO line + PO statuses
 */
export async function POST(req: MedusaRequest, res: MedusaResponse) {
  const batchService = req.scope.resolve(INVENTORY_BATCH_MODULE) as any
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)
  const inventoryService = req.scope.resolve(Modules.INVENTORY) as any
  const { id } = req.params
  const body = req.body as Record<string, any>

  try {
    const po = await batchService.retrievePurchaseOrder(id, {
      relations: ["lines"],
    })

    if (po.status === "cancelled") {
      return res.status(400).json({ message: "Cannot receive a cancelled PO" })
    }
    if (po.status === "received") {
      return res.status(400).json({ message: "PO has already been fully received" })
    }

    const lineOverrides: LineOverride[] = body.line_overrides || []
    const overrideMap = new Map(lineOverrides.map((o) => [o.line_id, o]))
    const grnNumber = body.grn_number || po.grn_number
    let batchesCreated = 0
    let inventoryUpdated = 0
    let hasRejected = false
    let hasPartial = false

    for (const line of po.lines) {
      const override = overrideMap.get(line.id)

      if (override?.line_status === "rejected") {
        await batchService.updatePurchaseOrderLines({
          id: line.id,
          line_status: "rejected",
          rejection_reason: override.rejection_reason || null,
          received_quantity: 0,
        })
        hasRejected = true
        continue
      }

      const receivedQty = override?.received_quantity ?? Number(line.ordered_quantity)
      const lineStatus = override?.line_status
        ?? (receivedQty < Number(line.ordered_quantity) ? "partial" : "received")

      if (lineStatus === "partial") hasPartial = true

      // 1. Create a Batch record (lot tracking with FEFO)
      const batch = await batchService.createBatches({
        product_variant_id: line.product_variant_id,
        product_id: line.product_id,
        lot_number: line.lot_number,
        expiry_date: line.expiry_date,
        manufactured_on: line.manufactured_on || null,
        received_quantity: receivedQty,
        available_quantity: receivedQty,
        reserved_quantity: 0,
        batch_mrp_paise: line.mrp_paise ? Number(line.mrp_paise) : null,
        purchase_price_paise: Number(line.purchase_price_paise),
        location_id: po.location_id || null,
        supplier_name: po.supplier_name,
        grn_number: grnNumber || null,
        received_on: new Date().toISOString(),
        status: "active",
        purchase_order_ref: po.po_number,
      })
      batchesCreated++

      // 2. Update Medusa's built-in Inventory stock levels
      try {
        // Find the inventory item linked to this variant
        const { data: variantLinks } = await query.graph({
          entity: "product_variant_inventory_item",
          fields: ["inventory_item_id", "variant_id"],
          filters: { variant_id: line.product_variant_id },
        })
        const inventoryItemId = (variantLinks as any[])?.[0]?.inventory_item_id

        if (inventoryItemId) {
          // Find existing stock levels
          const { data: levels } = await query.graph({
            entity: "inventory_level",
            fields: ["id", "stocked_quantity", "location_id"],
            filters: { inventory_item_id: inventoryItemId },
          })

          if ((levels as any[])?.length > 0) {
            const level = (levels as any[])[0]
            await inventoryService.updateInventoryLevels({
              id: level.id,
              stocked_quantity: Number(level.stocked_quantity) + receivedQty,
            })
            inventoryUpdated++
          }
        }
      } catch (invErr: any) {
        const logger = req.scope.resolve(ContainerRegistrationKeys.LOGGER) as any
        logger?.warn?.(`[receive] Inventory update failed for ${line.product_variant_id}: ${invErr?.message}`)
      }

      // 3. Update the PO line
      await batchService.updatePurchaseOrderLines({
        id: line.id,
        received_quantity: receivedQty,
        line_status: lineStatus,
        batch_id: batch.id,
      })
    }

    // Update PO status
    const poStatus = (hasRejected || hasPartial) ? "partial" : "received"
    await batchService.updatePurchaseOrders({
      id: po.id,
      status: poStatus,
      received_date: new Date().toISOString(),
      received_by: body.received_by || null,
      grn_number: grnNumber || null,
    })

    // 4. MRP conflict check + product-level MRP sync
    const logger = req.scope.resolve(ContainerRegistrationKeys.LOGGER) as any
    const affectedProductIds: string[] = po.lines.map((l: any) => l.product_id)
    let mrpConflicts: any[] = []

    try {
      // Build items for conflict check from the PO lines
      const mrpCheckItems = po.lines
        .filter((l: any) => l.mrp_paise != null)
        .map((l: any) => ({
          product_id: l.product_id,
          variant_id: l.product_variant_id,
          batch_mrp_paise: Number(l.mrp_paise),
        }))

      if (mrpCheckItems.length > 0) {
        mrpConflicts = await checkMrpConflicts(req.scope, mrpCheckItems)
      }

      // Sync drug_product.mrp_paise to the lowest active batch MRP
      await syncProductMrpFromBatches(req.scope, affectedProductIds)

      // Emit event if there are MRP conflicts so the subscriber creates admin notifications
      if (mrpConflicts.length > 0) {
        try {
          const eventBus = req.scope.resolve(Modules.EVENT_BUS) as any
          await eventBus.emit({
            name: "batch.mrp_conflict",
            data: { conflicts: mrpConflicts, po_number: po.po_number },
          })
        } catch (evtErr: any) {
          logger.warn(`[receive] Failed to emit mrp_conflict event: ${evtErr?.message}`)
        }
      }
    } catch (mrpErr: any) {
      logger.warn(`[receive] MRP validation/sync failed (non-fatal): ${mrpErr?.message}`)
    }

    const result = await batchService.retrievePurchaseOrder(id, {
      relations: ["lines"],
    })

    return res.json({
      purchase_order: result,
      batches_created: batchesCreated,
      inventory_updated: inventoryUpdated,
      mrp_conflicts: mrpConflicts,
    })
  } catch (err: any) {
    return res.status(400).json({ message: err?.message || "Failed to receive purchase order" })
  }
}
