import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys, MedusaError } from "@medusajs/framework/utils"

/**
 * GET /store/products/pharma?handle=<product-handle>
 *
 * Returns pharma metadata linked to a product via the `product-drug` link.
 * We keep this separate from core /store/products because Medusa's field selection
 * doesn't support selecting custom link fields reliably in the default route.
 */
export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const handle = (req.query.handle as string | undefined)?.trim()
  if (!handle) {
    throw new MedusaError(
      MedusaError.Types.INVALID_DATA,
      "Missing required query param: handle"
    )
  }

  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)

  const { data: products } = await query.graph({
    entity: "product",
    fields: ["id", "handle"],
    filters: { handle },
  })

  const product = (products as any[])?.[0] as { id: string; handle: string } | undefined
  if (!product?.id) {
    throw new MedusaError(MedusaError.Types.NOT_FOUND, "Product not found")
  }

  // IMPORTANT:
  // Expanding `drug_product.*` on the `product` entity can trigger Medusa "unknown_error"
  // in some setups. Query the pharma entity directly instead.
  const { data: drugProducts } = await query.graph({
    entity: "drug_product",
    fields: ["*"],
    filters: { product_id: product.id },
  })

  const drug_product = (drugProducts as any[])?.[0] ?? null

  return res.json({
    drug_product,
  })
}

