import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { LOYALTY_MODULE } from "../../../modules/loyalty"

/**
 * GET /admin/loyalty — returns loyalty program summary for the admin dashboard.
 * Includes total accounts, points outstanding, tier distribution, and account list.
 */
export const GET = async (req: MedusaRequest, res: MedusaResponse) => {
  const loyaltyService = req.scope.resolve(LOYALTY_MODULE) as any

  const accounts = await loyaltyService.listLoyaltyAccounts({}, { take: null })

  const tierDistribution = { bronze: 0, silver: 0, gold: 0, platinum: 0 }
  let totalPointsOutstanding = 0
  let totalLifetimePoints = 0

  for (const acct of accounts) {
    totalPointsOutstanding += acct.points_balance ?? 0
    totalLifetimePoints += acct.lifetime_points ?? 0
    if (acct.tier in tierDistribution) {
      tierDistribution[acct.tier as keyof typeof tierDistribution]++
    }
  }

  res.json({
    total_accounts: accounts.length,
    total_points_outstanding: totalPointsOutstanding,
    total_lifetime_points: totalLifetimePoints,
    tier_distribution: tierDistribution,
    accounts,
  })
}
