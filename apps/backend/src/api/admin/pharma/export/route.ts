import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { PHARMA_MODULE } from "../../../../modules/pharma"
import { INVENTORY_BATCH_MODULE } from "../../../../modules/inventoryBatch"

/**
 * GET /admin/pharma/export
 * Exports all products with pharma metadata and batch data as CSV.
 * Each product-batch combination gets its own row. Products without
 * batches still get one row with empty batch columns.
 */
export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)
  const pharmaService = req.scope.resolve(PHARMA_MODULE) as any
  const batchService = req.scope.resolve(INVENTORY_BATCH_MODULE) as any

  const { data: products } = await query.graph({
    entity: "product",
    fields: ["id", "title", "handle", "description", "status", "metadata"],
  })

  const drugProducts = await pharmaService.listDrugProducts({})
  const drugByProductId = new Map<string, any>(
    drugProducts.map((d: any) => [d.product_id, d])
  )

  const allBatches = await batchService.listBatches({}, { order: { expiry_date: "ASC" } })
  const batchesByProductId = new Map<string, any[]>()
  for (const b of allBatches) {
    const arr = batchesByProductId.get(b.product_id) || []
    arr.push(b)
    batchesByProductId.set(b.product_id, arr)
  }

  const headers = [
    "brand_name", "generic_name", "composition", "strength", "dosage_form",
    "pack_size", "unit_type", "schedule", "therapeutic_class", "category",
    "collection", "selling_price_inr", "mrp_inr", "gst_rate", "hsn_code",
    "stock_qty", "manufacturer", "manufacturer_license", "description",
    "indications", "contraindications", "side_effects", "storage_instructions",
    "dosage_instructions", "is_chronic", "habit_forming", "requires_refrigeration",
    "is_narcotic", "tags",
    "batch_lot_number", "batch_expiry_date", "batch_manufactured_on",
    "batch_mrp_inr", "batch_purchase_price_inr", "batch_supplier",
    "batch_grn_number",
  ]

  function escapeCSV(val: string | null | undefined): string {
    if (val == null) return ""
    const str = String(val)
    if (str.includes(",") || str.includes('"') || str.includes("\n")) {
      return `"${str.replace(/"/g, '""')}"`
    }
    return str
  }

  function formatDate(d?: string | null): string {
    if (!d) return ""
    return new Date(d).toISOString().split("T")[0]
  }

  const rows: string[] = [headers.join(",")]

  for (const product of products as any[]) {
    const drug = drugByProductId.get(product.id)
    const batches = batchesByProductId.get(product.id) || [null]

    for (const batch of batches) {
      const row = [
        product.title,
        drug?.generic_name || "",
        drug?.composition || "",
        drug?.strength || "",
        drug?.dosage_form || "",
        drug?.pack_size || "",
        drug?.unit_type || "",
        drug?.schedule || "",
        drug?.therapeutic_class || "",
        "", // category
        "", // collection
        "", // selling_price_inr
        drug?.mrp_paise ? String(drug.mrp_paise / 100) : "",
        drug?.gst_rate != null ? String(drug.gst_rate) : "",
        drug?.hsn_code || "",
        batch ? String(batch.available_quantity) : "",
        product.metadata?.manufacturer || "",
        drug?.manufacturer_license || "",
        product.description || "",
        drug?.indications || "",
        drug?.contraindications || "",
        drug?.side_effects || "",
        drug?.storage_instructions || "",
        drug?.dosage_instructions || "",
        drug?.is_chronic ? "true" : "false",
        drug?.habit_forming ? "true" : "false",
        drug?.requires_refrigeration ? "true" : "false",
        drug?.is_narcotic ? "true" : "false",
        "", // tags
        batch?.lot_number || "",
        formatDate(batch?.expiry_date),
        formatDate(batch?.manufactured_on),
        batch?.batch_mrp_paise ? String(batch.batch_mrp_paise / 100) : "",
        batch?.purchase_price_paise ? String(batch.purchase_price_paise / 100) : "",
        batch?.supplier_name || "",
        batch?.grn_number || "",
      ]
      rows.push(row.map(escapeCSV).join(","))
    }
  }

  const csv = rows.join("\n")
  res.setHeader("Content-Type", "text/csv")
  res.setHeader("Content-Disposition", "attachment; filename=suprameds-products-export.csv")
  return res.send(csv)
}
