import {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import { WISHLIST_MODULE } from "../../../modules/wishlist"

/**
 * GET /store/wishlist
 *
 * Returns all wishlist items for the authenticated customer.
 */
export const GET = async (
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) => {
  const customerId = (req as any).auth_context?.actor_id
  if (!customerId) {
    return res.status(401).json({ error: "Authentication required" })
  }

  const wishlistService = req.scope.resolve(WISHLIST_MODULE) as any

  const items = await wishlistService.getWishlistForCustomer(customerId)

  return res.json({ wishlist: items, count: items.length })
}

/**
 * POST /store/wishlist
 *
 * Adds a product to the customer's wishlist.
 * Body: { product_id: string, variant_id?: string, current_price?: number }
 */
export const POST = async (
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) => {
  const customerId = (req as any).auth_context?.actor_id
  if (!customerId) {
    return res.status(401).json({ error: "Authentication required" })
  }

  const { product_id, variant_id, current_price } = req.body as {
    product_id?: string
    variant_id?: string
    current_price?: number
  }

  if (!product_id) {
    return res.status(400).json({ error: "product_id is required" })
  }

  const wishlistService = req.scope.resolve(WISHLIST_MODULE) as any

  const alreadyWishlisted = await wishlistService.isProductWishlisted(
    customerId,
    product_id
  )

  if (alreadyWishlisted) {
    return res
      .status(409)
      .json({ error: "Product is already in your wishlist" })
  }

  const item = await wishlistService.createWishlistItems({
    customer_id: customerId,
    product_id,
    variant_id: variant_id ?? null,
    price_at_addition: current_price ?? 0,
  })

  return res.status(201).json({ wishlist_item: item })
}

/**
 * DELETE /store/wishlist
 *
 * Removes a product from the customer's wishlist.
 * Body: { product_id?: string, wishlist_item_id?: string }
 */
export const DELETE = async (
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) => {
  const customerId = (req as any).auth_context?.actor_id
  if (!customerId) {
    return res.status(401).json({ error: "Authentication required" })
  }

  const { product_id, wishlist_item_id } = req.body as {
    product_id?: string
    wishlist_item_id?: string
  }

  if (!product_id && !wishlist_item_id) {
    return res
      .status(400)
      .json({ error: "product_id or wishlist_item_id is required" })
  }

  const wishlistService = req.scope.resolve(WISHLIST_MODULE) as any

  if (wishlist_item_id) {
    // Delete by ID — verify ownership first
    const [item] = await wishlistService.listWishlistItems({
      id: wishlist_item_id,
      customer_id: customerId,
    })
    if (!item) {
      return res.status(404).json({ error: "Wishlist item not found" })
    }
    await wishlistService.deleteWishlistItems(wishlist_item_id)
  } else {
    // Delete by product_id + customer_id
    const items = await wishlistService.listWishlistItems({
      customer_id: customerId,
      product_id,
    })
    if (!items.length) {
      return res.status(404).json({ error: "Wishlist item not found" })
    }
    for (const item of items) {
      await wishlistService.deleteWishlistItems(item.id)
    }
  }

  return res.json({ success: true })
}
