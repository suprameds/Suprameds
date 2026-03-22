import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys, MedusaError } from "@medusajs/framework/utils"
import { checkInteractions } from "../../../../utils/drug-interactions"

/**
 * GET /store/products/interactions?product_ids=id1,id2,...
 *
 * Checks known drug interactions between the provided products by resolving
 * their pharma composition data and running pairwise interaction checks.
 *
 * Returns { interactions: InteractionWarning[], has_major: boolean }
 */
export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const raw = req.query.product_ids as string | undefined
  if (!raw?.trim()) {
    throw new MedusaError(
      MedusaError.Types.INVALID_DATA,
      "Missing required query param: product_ids (comma-separated product IDs)"
    )
  }

  const productIds = raw
    .split(",")
    .map((id) => id.trim())
    .filter(Boolean)

  if (productIds.length < 2) {
    return res.json({ interactions: [], has_major: false })
  }

  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)

  // Resolve drug product metadata for all provided product IDs
  const { data: drugProducts } = await query.graph({
    entity: "drug_product",
    fields: ["id", "product_id", "composition", "generic_name"],
    filters: { product_id: productIds },
  })

  // Build composition list from drug products that have composition data
  const compositions = (drugProducts as any[])
    .filter((dp) => dp.composition)
    .map((dp) => dp.composition as string)

  if (compositions.length < 2) {
    return res.json({ interactions: [], has_major: false })
  }

  const interactions = checkInteractions(compositions)
  const has_major = interactions.some((w) => w.severity === "major")

  return res.json({ interactions, has_major })
}
