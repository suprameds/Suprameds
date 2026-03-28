import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

/**
 * POST /admin/inventory/import
 *
 * Bulk update stock levels and optionally create inventory batches.
 * Matches products by SKU.
 *
 * Body: { rows: InventoryRow[], mode?: "add" | "set" }
 *   mode "add" (default): adds quantity to existing stock
 *   mode "set": sets stock to exact quantity
 *
 * CSV columns (matching inventory-update-template.csv):
 *   SKU*, Stock Quantity*,
 *   Batch Lot Number, Batch Expiry Date, Batch Manufactured On,
 *   Batch MRP INR, Batch Purchase Price INR, Batch Supplier, Batch GRN Number
 */

interface InventoryRow {
  sku: string
  stock_quantity: number
  batch_lot_number?: string
  batch_expiry_date?: string
  batch_manufactured_on?: string
  batch_mrp_inr?: number
  batch_purchase_price_inr?: number
  batch_supplier?: string
  batch_grn_number?: string
}

function normalizeRow(raw: Record<string, string>): InventoryRow | null {
  const sku = (raw["SKU"] || raw["sku"] || "").trim()
  const qty = parseInt(raw["Stock Quantity"] || raw["stock_quantity"] || "0", 10)

  if (!sku || isNaN(qty) || qty < 0) return null

  return {
    sku,
    stock_quantity: qty,
    batch_lot_number: (raw["Batch Lot Number"] || raw["batch_lot_number"] || "").trim() || undefined,
    batch_expiry_date: (raw["Batch Expiry Date"] || raw["batch_expiry_date"] || "").trim() || undefined,
    batch_manufactured_on: (raw["Batch Manufactured On"] || raw["batch_manufactured_on"] || "").trim() || undefined,
    batch_mrp_inr: parseFloat(raw["Batch MRP INR"] || raw["batch_mrp_inr"] || "") || undefined,
    batch_purchase_price_inr: parseFloat(raw["Batch Purchase Price INR"] || raw["batch_purchase_price_inr"] || "") || undefined,
    batch_supplier: (raw["Batch Supplier"] || raw["batch_supplier"] || "").trim() || undefined,
    batch_grn_number: (raw["Batch GRN Number"] || raw["batch_grn_number"] || "").trim() || undefined,
  }
}

export async function POST(req: MedusaRequest, res: MedusaResponse) {
  const { rows: rawRows, mode = "add" } = req.body as {
    rows: Record<string, string>[]
    mode?: "add" | "set"
  }

  if (!rawRows?.length) {
    return res.status(400).json({ error: "No rows provided" })
  }

  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)
  const inventoryService = req.scope.resolve("inventoryService" as any) as any
  const results: { sku: string; status: string; message?: string }[] = []
  let updated = 0
  let skipped = 0
  let errors = 0

  // Get stock location
  const { data: stockLocations } = await query.graph({
    entity: "stock_location",
    fields: ["id"],
  })
  const stockLocationId = (stockLocations as any[])?.[0]?.id
  if (!stockLocationId) {
    return res.status(500).json({ error: "No stock location found" })
  }

  // Resolve all SKUs → inventory item IDs
  const skus = rawRows.map((r) => (r["SKU"] || r["sku"] || "").trim()).filter(Boolean)
  const { data: variants } = await query.graph({
    entity: "variant",
    fields: ["id", "sku", "product_id"],
    filters: { sku: skus },
  })
  const variantBySku = new Map((variants as any[]).map((v) => [v.sku, v]))

  // Get inventory items linked to these variants
  const variantIds = (variants as any[]).map((v) => v.id)
  const { data: inventoryLinks } = await query.graph({
    entity: "product_variant_inventory_item",
    fields: ["variant_id", "inventory_item_id"],
    filters: { variant_id: variantIds },
  })
  const invItemByVariantId = new Map(
    (inventoryLinks as any[]).map((l) => [l.variant_id, l.inventory_item_id])
  )

  for (const rawRow of rawRows) {
    const row = normalizeRow(rawRow)
    if (!row) {
      errors++
      results.push({
        sku: rawRow["SKU"] || rawRow["sku"] || "(empty)",
        status: "error",
        message: "Invalid row: missing SKU or stock quantity",
      })
      continue
    }

    const variant = variantBySku.get(row.sku)
    if (!variant) {
      skipped++
      results.push({ sku: row.sku, status: "skipped", message: "SKU not found" })
      continue
    }

    const inventoryItemId = invItemByVariantId.get(variant.id)
    if (!inventoryItemId) {
      skipped++
      results.push({ sku: row.sku, status: "skipped", message: "No inventory item linked" })
      continue
    }

    try {
      // Get current stock level
      const { data: levels } = await query.graph({
        entity: "inventory_level",
        fields: ["id", "stocked_quantity"],
        filters: {
          inventory_item_id: inventoryItemId,
          location_id: stockLocationId,
        },
      })

      const level = (levels as any[])?.[0]
      if (level) {
        const newQty = mode === "set" ? row.stock_quantity : level.stocked_quantity + row.stock_quantity
        await inventoryService.updateInventoryLevels([
          { id: level.id, stocked_quantity: newQty },
        ])
      }

      // Create batch if lot data provided
      if (row.batch_lot_number && row.batch_expiry_date) {
        const pharmaService = req.scope.resolve("pharmaCore" as any) as any
        try {
          await pharmaService.createInventoryBatches([
            {
              product_id: variant.product_id,
              variant_id: variant.id,
              lot_number: row.batch_lot_number,
              expiry_date: new Date(row.batch_expiry_date),
              manufactured_on: row.batch_manufactured_on ? new Date(row.batch_manufactured_on) : undefined,
              mrp_paise: row.batch_mrp_inr ? row.batch_mrp_inr * 100 : undefined,
              purchase_price_paise: row.batch_purchase_price_inr ? row.batch_purchase_price_inr * 100 : undefined,
              supplier: row.batch_supplier,
              grn_number: row.batch_grn_number,
              quantity: row.stock_quantity,
              status: "active",
              source: "inventory-import",
            },
          ])
        } catch {
          // Stock updated but batch creation failed — still count as updated
        }
      }

      updated++
      results.push({ sku: row.sku, status: "updated", message: `Stock ${mode === "set" ? "set to" : "added"} ${row.stock_quantity}` })
    } catch (err: any) {
      errors++
      results.push({ sku: row.sku, status: "error", message: err?.message || "Unknown error" })
    }
  }

  return res.json({
    summary: { total: rawRows.length, updated, skipped, errors },
    results,
  })
}
