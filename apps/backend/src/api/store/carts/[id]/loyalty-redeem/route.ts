import type {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import { Modules } from "@medusajs/framework/utils"
import { LOYALTY_MODULE } from "../../../../../modules/loyalty"

/**
 * POST /store/carts/:id/loyalty-redeem
 *
 * Apply loyalty points as a discount on the cart.
 * Stores redemption in cart metadata. Points are burned on order completion.
 *
 * Body: { points: number }
 *
 * Redemption rate: 1 point = ₹1 discount
 * Max: customer's balance or cart subtotal (whichever is lower)
 */
export async function POST(
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) {
  const cartId = req.params.id
  const { points } = req.body as { points?: number }

  if (!points || points <= 0) {
    return res.status(400).json({ message: "points must be a positive number" })
  }

  const customerId = req.auth_context?.actor_id
  if (!customerId) {
    return res.status(401).json({ message: "Authentication required" })
  }

  try {
    const loyaltyService = req.scope.resolve(LOYALTY_MODULE) as any
    const cartService = req.scope.resolve(Modules.CART) as any

    // Validate customer has enough points
    const [account] = await loyaltyService.listLoyaltyAccounts(
      { customer_id: customerId },
      { take: 1 }
    )

    if (!account) {
      return res.status(400).json({ message: "No loyalty account found" })
    }

    if (points > account.points_balance) {
      return res.status(400).json({
        message: `Insufficient points. Available: ${account.points_balance}, requested: ${points}`,
      })
    }

    // Calculate discount (1 point = ₹1)
    const discountAmount = loyaltyService.pointsToInr(points)

    // Get cart to validate discount doesn't exceed subtotal
    const cart = await cartService.retrieveCart(cartId, {
      relations: ["items"],
    })

    if (!cart) {
      return res.status(404).json({ message: "Cart not found" })
    }

    // Cap discount at cart subtotal
    const cartSubtotal = Number(cart.subtotal ?? cart.total ?? 0)
    const cappedPoints = Math.min(points, Math.floor(cartSubtotal))
    const cappedDiscount = loyaltyService.pointsToInr(cappedPoints)

    // Store in cart metadata (points are burned on order completion)
    const existingMeta = (cart.metadata as Record<string, any>) || {}
    await cartService.updateCarts(cartId, {
      metadata: {
        ...existingMeta,
        loyalty_points_redeemed: cappedPoints,
        loyalty_discount_amount: cappedDiscount,
        loyalty_account_id: account.id,
      },
    })

    return res.status(200).json({
      success: true,
      points_applied: cappedPoints,
      discount_amount: cappedDiscount,
      points_remaining: account.points_balance - cappedPoints,
    })
  } catch (error: any) {
    return res.status(500).json({ message: error.message || "Failed to apply loyalty points" })
  }
}

/**
 * DELETE /store/carts/:id/loyalty-redeem
 *
 * Remove loyalty points redemption from the cart.
 */
export async function DELETE(
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) {
  const cartId = req.params.id

  try {
    const cartService = req.scope.resolve(Modules.CART) as any
    const cart = await cartService.retrieveCart(cartId)

    if (!cart) {
      return res.status(404).json({ message: "Cart not found" })
    }

    const existingMeta = (cart.metadata as Record<string, any>) || {}
    const { loyalty_points_redeemed, loyalty_discount_amount, loyalty_account_id, ...restMeta } = existingMeta

    await cartService.updateCarts(cartId, { metadata: restMeta })

    return res.status(200).json({
      success: true,
      points_removed: loyalty_points_redeemed ?? 0,
    })
  } catch (error: any) {
    return res.status(500).json({ message: error.message || "Failed to remove loyalty points" })
  }
}
