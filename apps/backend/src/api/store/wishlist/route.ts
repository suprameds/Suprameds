import {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { WISHLIST_MODULE } from "../../../modules/wishlist"

/**
 * GET /store/wishlist
 *
 * Returns all wishlist items for the authenticated customer,
 * enriched with live product data (title, handle, thumbnail, price).
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
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY) as any

  const items = await wishlistService.getWishlistForCustomer(customerId)

  if (!items.length) {
    return res.json({ wishlist: [], count: 0 })
  }

  // Fetch product data for all wishlist items in a single query
  const productIds = [...new Set(items.map((i: any) => i.product_id))]
  let productMap: Record<string, any> = {}

  try {
    const { data: products } = await query.graph({
      entity: "product",
      fields: ["id", "title", "handle", "thumbnail", "*variants.calculated_price"],
      filters: { id: productIds },
      context: {
        variants: {
          calculated_price: {
            context: {
              currency_code: "inr",
            },
          },
        },
      },
    })

    for (const p of (Array.isArray(products) ? products : [])) {
      productMap[p.id] = p
    }
  } catch {
    // Product query failed — return items without enrichment
  }

  const enriched = items.map((item: any) => {
    const product = productMap[item.product_id]
    const cheapestVariant = product?.variants
      ?.filter((v: any) => v.calculated_price?.calculated_amount != null)
      ?.sort((a: any, b: any) =>
        a.calculated_price.calculated_amount - b.calculated_price.calculated_amount
      )?.[0]

    return {
      ...item,
      product_title: product?.title ?? null,
      product_handle: product?.handle ?? null,
      thumbnail: product?.thumbnail ?? null,
      current_price: cheapestVariant?.calculated_price?.calculated_amount ?? null,
    }
  })

  return res.json({ wishlist: enriched, count: enriched.length })
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
    await wishlistService.deleteWishlistItems(items.map((i: any) => i.id))
  }

  return res.json({ success: true })
}
