import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

/**
 * GET /store/products/pharma/batch?product_ids=id1,id2,id3
 *
 * Returns pharma (drug_product) metadata for multiple products in one call.
 * Used by the storefront to determine which cart items are Rx (H/H1).
 */
export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const raw = (req.query.product_ids as string) ?? ""
  const productIds = raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)

  if (productIds.length === 0) {
    return res.json({ drug_products: [] })
  }

  if (productIds.length > 100) {
    return res.status(400).json({ error: "Maximum 100 product IDs per request" })
  }

  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)

  const { data: drugProducts } = await query.graph({
    entity: "drug_product",
    fields: [
      "id",
      "product_id",
      "schedule",
      "generic_name",
      "dosage_form",
      "strength",
      "composition",
    ],
    filters: { product_id: productIds },
  })

  return res.json({ drug_products: drugProducts ?? [] })
}
