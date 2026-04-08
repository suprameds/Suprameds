import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { WALLET_MODULE } from "../../../modules/wallet"

/**
 * GET /store/wallet
 * Returns wallet balance and recent transactions for the authenticated customer.
 */
export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const customerId = (req as any).auth_context?.actor_id
  if (!customerId) {
    return res.status(401).json({ message: "Authentication required" })
  }

  const walletService = req.scope.resolve(WALLET_MODULE) as any

  const account = await walletService.getOrCreateAccount(customerId)
  const transactions = await walletService.getTransactions(customerId, 20, 0)

  res.json({
    wallet: {
      id: account.id,
      balance: account.balance,
      currency_code: account.currency_code,
    },
    transactions: transactions.map((t: any) => ({
      id: t.id,
      type: t.type,
      amount: t.amount,
      reference_type: t.reference_type,
      reference_id: t.reference_id,
      reason: t.reason,
      created_at: t.created_at,
    })),
  })
}
