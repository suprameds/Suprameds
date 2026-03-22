import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { LOYALTY_MODULE } from "../../../../../modules/loyalty"

/**
 * GET /admin/loyalty/customer/:id — returns a customer's loyalty account and recent transactions.
 * Powers the customer-loyalty admin widget.
 */
export const GET = async (req: MedusaRequest, res: MedusaResponse) => {
  const customerId = req.params.id
  const loyaltyService = req.scope.resolve(LOYALTY_MODULE) as any

  const [account] = await loyaltyService.listLoyaltyAccounts(
    { customer_id: customerId },
    { take: 1 }
  )

  if (!account) {
    return res.json({ account: null, transactions: [] })
  }

  // Fetch recent transactions for this account, newest first
  const transactions = await loyaltyService.listLoyaltyTransactions(
    { account_id: account.id },
    { take: 20, order: { created_at: "DESC" } }
  )

  res.json({ account, transactions })
}
