import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

/**
 * GET /store/products/pharma/bulk
 *
 * Two modes:
 *
 * 1. ENRICH mode (ids present):
 *    ?ids=prod_1,prod_2,prod_3
 *    Returns pharma metadata keyed by product_id for display (MRP, schedule, etc.)
 *
 * 2. FILTER mode (schedule or dosage_form present, no ids):
 *    ?schedule=OTC&dosage_form=tablet
 *    Returns { product_ids: string[] } — matching product IDs for Medusa's
 *    paginated product list (pass as `id` filter).
 *    Supports "rx" alias → matches both H and H1.
 */
export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const idsParam = (req.query.ids as string | undefined)?.trim()
  const scheduleParam = req.query.schedule as string | undefined
  const dosageFormParam = req.query.dosage_form as string | undefined

  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)

  // ── FILTER mode: return matching product_ids ──
  if (!idsParam && (scheduleParam || dosageFormParam)) {
    const filters: Record<string, any> = {}
    if (scheduleParam) {
      if (scheduleParam.toLowerCase() === "rx") {
        filters.schedule = ["H", "H1"]
      } else {
        filters.schedule = scheduleParam.toUpperCase()
      }
    }
    if (dosageFormParam) {
      filters.dosage_form = dosageFormParam.toLowerCase()
    }

    const { data: drugProducts } = await query.graph({
      entity: "drug_product",
      fields: ["product_id"],
      filters,
    })

    const productIds = (drugProducts as any[])
      .map((dp) => dp.product_id)
      .filter(Boolean)

    return res.json({ product_ids: productIds })
  }

  // ── ENRICH mode: return metadata keyed by product_id ──
  if (!idsParam) {
    return res.json({ drug_products: {} })
  }

  const productIds = idsParam.split(",").map((id) => id.trim()).filter(Boolean)
  if (productIds.length === 0) {
    return res.json({ drug_products: {} })
  }

  const { data: drugProducts } = await query.graph({
    entity: "drug_product",
    fields: [
      "id",
      "product_id",
      "mrp_paise",
      "schedule",
      "generic_name",
      "dosage_form",
      "strength",
      "composition",
      "pack_size",
      "unit_type",
      "therapeutic_class",
      "gst_rate",
      "habit_forming",
      "is_chronic",
      "metadata",
    ],
    filters: { product_id: productIds },
  })

  // Key by product_id, extracting manufacturer from metadata
  const byProductId: Record<string, any> = {}
  for (const dp of drugProducts as any[]) {
    const meta = dp.metadata as Record<string, any> | null
    byProductId[dp.product_id] = {
      ...dp,
      manufacturer: meta?.manufacturer ?? null,
      metadata: undefined, // strip heavy metadata from listing response
    }
  }

  return res.json({ drug_products: byProductId })
}
