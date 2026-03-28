import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { updateProductVariantsWorkflow } from "@medusajs/medusa/core-flows"
import { PHARMA_MODULE } from "../../../../modules/pharma"

/**
 * POST /admin/prices/import
 *
 * Bulk update selling prices, MRP, and GST rates by SKU.
 *
 * Body: { rows: PriceRow[] }
 *
 * CSV columns (matching price-update-template.csv):
 *   SKU*, Selling Price INR, MRP INR, GST Rate
 *
 * - Selling Price: updates the INR variant price
 * - MRP: updates drug_product.mrp_paise (stored as paise)
 * - GST Rate: updates drug_product.gst_rate
 */

interface PriceRow {
  sku: string
  selling_price_inr?: number
  mrp_inr?: number
  gst_rate?: number
}

function normalizeRow(raw: Record<string, string>): PriceRow | null {
  const sku = (raw["SKU"] || raw["sku"] || "").trim()
  if (!sku) return null

  return {
    sku,
    selling_price_inr: parseFloat(raw["Selling Price INR"] || raw["selling_price_inr"] || "") || undefined,
    mrp_inr: parseFloat(raw["MRP INR"] || raw["mrp_inr"] || "") || undefined,
    gst_rate: parseFloat(raw["GST Rate"] || raw["gst_rate"] || "") ?? undefined,
  }
}

export async function POST(req: MedusaRequest, res: MedusaResponse) {
  const { rows: rawRows } = req.body as { rows: Record<string, string>[] }

  if (!rawRows?.length) {
    return res.status(400).json({ error: "No rows provided" })
  }

  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)
  const pharmaService = req.scope.resolve(PHARMA_MODULE) as any
  const results: { sku: string; status: string; message?: string }[] = []
  let updated = 0
  let skipped = 0
  let errors = 0

  // Resolve SKUs → variants + product IDs
  const skus = rawRows.map((r) => (r["SKU"] || r["sku"] || "").trim()).filter(Boolean)
  const { data: variants } = await query.graph({
    entity: "variant",
    fields: ["id", "sku", "product_id"],
    filters: { sku: skus },
  })
  const variantBySku = new Map((variants as any[]).map((v) => [v.sku, v]))

  // Resolve product IDs → drug_product IDs
  const productIds = [...new Set((variants as any[]).map((v) => v.product_id).filter(Boolean))]
  const { data: drugProducts } = await query.graph({
    entity: "drug_product",
    fields: ["id", "product_id", "mrp_paise", "gst_rate"],
    filters: { product_id: productIds },
  })
  const drugByProductId = new Map((drugProducts as any[]).map((dp) => [dp.product_id, dp]))

  for (const rawRow of rawRows) {
    const row = normalizeRow(rawRow)
    if (!row) {
      errors++
      results.push({ sku: rawRow["SKU"] || "(empty)", status: "error", message: "Invalid row" })
      continue
    }

    const variant = variantBySku.get(row.sku)
    if (!variant) {
      skipped++
      results.push({ sku: row.sku, status: "skipped", message: "SKU not found" })
      continue
    }

    try {
      const changes: string[] = []

      // Update selling price (variant price)
      if (row.selling_price_inr) {
        await updateProductVariantsWorkflow(req.scope).run({
          input: {
            product_variants: [
              {
                id: variant.id,
                prices: [{ currency_code: "inr", amount: row.selling_price_inr }],
              },
            ],
          },
        })
        changes.push(`price → ₹${row.selling_price_inr}`)
      }

      // Update MRP and/or GST on drug_product
      const drug = drugByProductId.get(variant.product_id)
      if (drug && (row.mrp_inr || row.gst_rate !== undefined)) {
        const updateData: Record<string, any> = { id: drug.id }
        if (row.mrp_inr) {
          updateData.mrp_paise = row.mrp_inr * 100
          changes.push(`MRP → ₹${row.mrp_inr}`)
        }
        if (row.gst_rate !== undefined) {
          updateData.gst_rate = row.gst_rate
          changes.push(`GST → ${row.gst_rate}%`)
        }
        await pharmaService.updateDrugProducts([updateData])
      }

      updated++
      results.push({ sku: row.sku, status: "updated", message: changes.join(", ") })
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
