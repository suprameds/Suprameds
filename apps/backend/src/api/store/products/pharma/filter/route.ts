import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

/**
 * GET /store/products/pharma/filter?schedule=OTC&dosage_form=tablet
 *
 * Returns product_ids matching the given pharma filters.
 * Designed for the storefront to pre-filter before calling
 * Medusa's paginated product list with `id: [...]`.
 *
 * Params (all optional, combine with AND):
 *   schedule    — "OTC" | "H" | "H1" (exact match)
 *   dosage_form — "tablet" | "capsule" | "syrup" | etc. (exact match)
 *
 * Returns: { product_ids: string[] }
 */
export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const schedule = req.query.schedule as string | undefined
  const dosageForm = req.query.dosage_form as string | undefined

  // No filters → return empty (frontend should not call this without filters)
  if (!schedule && !dosageForm) {
    return res.json({ product_ids: [] })
  }

  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)

  const filters: Record<string, any> = {}
  if (schedule) {
    // "rx" convenience alias → match both H and H1
    if (schedule.toLowerCase() === "rx") {
      filters.schedule = ["H", "H1"]
    } else {
      filters.schedule = schedule.toUpperCase()
    }
  }
  if (dosageForm) {
    filters.dosage_form = dosageForm.toLowerCase()
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
