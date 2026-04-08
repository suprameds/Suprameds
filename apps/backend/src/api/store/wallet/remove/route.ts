import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { Modules, MedusaError } from "@medusajs/framework/utils"

/**
 * DELETE /store/wallet/remove
 * Remove wallet balance from cart (clear cart.metadata wallet fields).
 *
 * Body: { cart_id: string }
 */
export async function DELETE(req: MedusaRequest, res: MedusaResponse) {
  const customerId = (req as any).auth_context?.actor_id
  if (!customerId) {
    return res.status(401).json({ message: "Authentication required" })
  }

  const { cart_id } = (req.body || {}) as { cart_id?: string }

  if (!cart_id) {
    throw new MedusaError(
      MedusaError.Types.INVALID_DATA,
      "cart_id is required"
    )
  }

  const cartService = req.scope.resolve(Modules.CART) as any

  const cart = await cartService.retrieveCart(cart_id)
  if (!cart) {
    throw new MedusaError(MedusaError.Types.NOT_FOUND, "Cart not found")
  }

  // Clear wallet fields from metadata
  const existingMetadata = (cart.metadata ?? {}) as Record<string, any>
  const { wallet_amount, wallet_account_id, ...restMetadata } = existingMetadata

  await cartService.updateCarts({
    id: cart_id,
    metadata: restMetadata,
  })

  res.json({
    success: true,
    message: "Wallet balance removed from cart",
  })
}
