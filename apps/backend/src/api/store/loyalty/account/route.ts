import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { LOYALTY_MODULE } from "../../../../modules/loyalty"

const TIER_THRESHOLDS = { bronze: 0, silver: 500, gold: 2000, platinum: 5000 }

export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const customerId = (req as any).auth_context?.actor_id
  if (!customerId) return res.status(401).json({ message: "Authentication required" })

  const loyaltyService = req.scope.resolve(LOYALTY_MODULE) as any

  // Find or create loyalty account
  let accounts = await loyaltyService.listLoyaltyAccounts({ customer_id: customerId })
  let account = accounts?.[0]

  if (!account) {
    // Auto-create account on first visit
    account = await loyaltyService.createLoyaltyAccounts({
      customer_id: customerId,
      points_balance: 0,
      tier: "bronze",
      lifetime_points: 0,
    })
  }

  // Get recent transactions
  const transactions = await loyaltyService.listLoyaltyTransactions(
    { account_id: account.id },
    { order: { created_at: "DESC" }, take: 20 }
  )

  // Calculate tier progress
  const tiers = Object.entries(TIER_THRESHOLDS).sort((a, b) => a[1] - b[1])
  const currentTierIdx = tiers.findIndex(([t]) => t === account.tier)
  const nextTier = currentTierIdx < tiers.length - 1 ? tiers[currentTierIdx + 1] : null
  const currentThreshold = tiers[currentTierIdx]?.[1] ?? 0
  const nextThreshold = nextTier?.[1] ?? currentThreshold
  const progress = nextTier
    ? Math.min(100, Math.round(((account.lifetime_points - currentThreshold) / (nextThreshold - currentThreshold)) * 100))
    : 100

  res.json({
    account: {
      id: account.id,
      points_balance: account.points_balance,
      tier: account.tier,
      lifetime_points: account.lifetime_points,
      referral_code: account.referral_code,
    },
    transactions: transactions.map((t: any) => ({
      id: t.id,
      type: t.type,
      points: t.points,
      reason: t.reason,
      reference_type: t.reference_type,
      reference_id: t.reference_id,
      created_at: t.created_at,
    })),
    tier_progress: {
      current_tier: account.tier,
      next_tier: nextTier?.[0] ?? null,
      points_to_next_tier: nextTier ? Math.max(0, nextThreshold - account.lifetime_points) : 0,
      progress_percent: progress,
    },
  })
}
