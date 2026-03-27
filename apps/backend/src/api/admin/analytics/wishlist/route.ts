import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { WISHLIST_MODULE } from "../../../../modules/wishlist"

/**
 * GET /admin/analytics/wishlist
 *
 * Returns the top 20 most wishlisted products across all customers.
 * Useful for understanding demand signals and prioritising restocking.
 */
export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const logger = req.scope.resolve("logger") as any
  const wishlistService = req.scope.resolve(WISHLIST_MODULE) as any

  try {
    const popular = await wishlistService.getPopularWishlistedProducts(20)

    return res.json({
      popular_products: popular,
      count: popular.length,
      generated_at: new Date().toISOString(),
    })
  } catch (err) {
    logger.error(
      `[analytics:wishlist] Query failed: ${(err as Error).message}`
    )
    return res.status(500).json({
      message: "Failed to generate wishlist analytics",
    })
  }
}
