import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { Modules, MedusaError } from "@medusajs/framework/utils"
import { WALLET_MODULE } from "../../../../modules/wallet"

/**
 * POST /store/wallet/apply
 * Apply wallet balance to the customer's active cart.
 *
 * Body: { cart_id: string, amount: number }
 * - `amount` is capped at both wallet balance and cart total.
 * - Stores wallet_amount and wallet_account_id in cart.metadata.
 */
export async function POST(req: MedusaRequest, res: MedusaResponse) {
  const customerId = (req as any).auth_context?.actor_id
  if (!customerId) {
    return res.status(401).json({ message: "Authentication required" })
  }

  const { cart_id, amount } = (req.body || {}) as {
    cart_id?: string
    amount?: number
  }

  if (!cart_id || !amount || amount <= 0) {
    throw new MedusaError(
      MedusaError.Types.INVALID_DATA,
      "cart_id and a positive amount are required"
    )
  }

  const walletService = req.scope.resolve(WALLET_MODULE) as any
  const cartService = req.scope.resolve(Modules.CART) as any

  // Verify the cart belongs to this customer
  const cart = await cartService.retrieveCart(cart_id)
  if (!cart) {
    throw new MedusaError(MedusaError.Types.NOT_FOUND, "Cart not found")
  }

  // Get wallet balance
  const account = await walletService.getOrCreateAccount(customerId)
  const walletBalance = account.balance

  if (walletBalance <= 0) {
    throw new MedusaError(
      MedusaError.Types.NOT_ALLOWED,
      "No wallet balance available"
    )
  }

  // Cap at wallet balance and cart total
  const cartTotal = cart.total ?? 0
  const applicableAmount = Math.min(amount, walletBalance, cartTotal)

  if (applicableAmount <= 0) {
    throw new MedusaError(
      MedusaError.Types.NOT_ALLOWED,
      "Amount exceeds available balance or cart total"
    )
  }

  // Store in cart metadata (actual debit happens at order creation)
  const existingMetadata = (cart.metadata ?? {}) as Record<string, any>
  await cartService.updateCarts({
    id: cart_id,
    metadata: {
      ...existingMetadata,
      wallet_amount: applicableAmount,
      wallet_account_id: account.id,
    },
  })

  res.json({
    wallet: {
      id: account.id,
      balance: walletBalance,
      applied_amount: applicableAmount,
      currency_code: account.currency_code,
    },
  })
}
