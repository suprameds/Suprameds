import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { PHARMA_MODULE } from "../../../../modules/pharma"

/**
 * POST /admin/pharma/drug-products
 * Creates a drug_product record and links it to an existing Medusa product.
 */
export async function POST(req: MedusaRequest, res: MedusaResponse) {
  const pharmaService = req.scope.resolve(PHARMA_MODULE) as any
  const body = req.body as Record<string, any>

  if (!body.product_id || !body.generic_name) {
    return res.status(400).json({
      message: "product_id and generic_name are required",
    })
  }

  try {
    const drugProduct = await pharmaService.createDrugProducts(body)
    return res.status(201).json({ drug_product: drugProduct })
  } catch (err: any) {
    return res.status(400).json({
      message: err?.message || "Failed to create drug product",
    })
  }
}

/**
 * GET /admin/pharma/drug-products?product_id=xxx
 * Retrieves drug metadata for a given product.
 */
export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const pharmaService = req.scope.resolve(PHARMA_MODULE) as any
  const productId = req.query.product_id as string

  if (!productId) {
    const all = await pharmaService.listDrugProducts({})
    return res.json({ drug_products: all })
  }

  const results = await pharmaService.listDrugProducts({
    product_id: productId,
  })

  return res.json({ drug_product: results[0] || null })
}
