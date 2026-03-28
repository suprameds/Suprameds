import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

/**
 * GET /store/products/pharma/bulk?ids=prod_1,prod_2,prod_3
 *
 * Returns pharma metadata (mrp_paise, schedule, generic_name, etc.)
 * for multiple product IDs in a single call. Used by listing pages
 * to compute MRP-based discount percentages without N+1 API calls.
 */
export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const idsParam = (req.query.ids as string | undefined)?.trim()
  if (!idsParam) {
    return res.json({ drug_products: {} })
  }

  const productIds = idsParam.split(",").map((id) => id.trim()).filter(Boolean)
  if (productIds.length === 0) {
    return res.json({ drug_products: {} })
  }

  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)

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
