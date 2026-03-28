import { MedusaService } from "@medusajs/framework/utils"
import LoyaltyAccount from "./models/loyalty-account"
import LoyaltyTransaction from "./models/loyalty-transaction"

// Tier thresholds (lifetime points)
const TIER_THRESHOLDS = {
  bronze: 0,
  silver: 500,
  gold: 2000,
  platinum: 5000,
} as const

// Points per rupee spent on OTC orders
const POINTS_PER_RUPEE = 1

class LoyaltyModuleService extends MedusaService({
  LoyaltyAccount,
  LoyaltyTransaction,
}) {
  async earnPoints(data: {
    customer_id: string
    order_id: string
    otc_amount: number
  }) {
    const points = Math.floor(data.otc_amount * POINTS_PER_RUPEE)
    if (points <= 0) return null

    let [account] = await this.listLoyaltyAccounts({ customer_id: data.customer_id })

    if (!account) {
      account = await this.createLoyaltyAccounts({
        customer_id: data.customer_id,
        points_balance: 0,
        tier: "bronze",
        lifetime_points: 0,
      })
    }

    const txn = await this.createLoyaltyTransactions({
      account_id: account.id,
      type: "earn",
      points,
      reference_type: "order",
      reference_id: data.order_id,
      reason: `Earned from OTC order ${data.order_id}`,
    })

    const newBalance = account.points_balance + points
    const newLifetime = account.lifetime_points + points
    const newTier = this.computeTier(newLifetime)

    await this.updateLoyaltyAccounts({
      id: account.id,
      points_balance: newBalance,
      lifetime_points: newLifetime,
      tier: newTier,
    })

    return { transaction: txn, new_balance: newBalance, tier: newTier }
  }

  async burnPoints(data: {
    customer_id: string
    order_id: string
    points: number
  }) {
    const [account] = await this.listLoyaltyAccounts({ customer_id: data.customer_id })

    if (!account) {
      throw new Error(`No loyalty account found for customer ${data.customer_id}`)
    }

    if (data.points > account.points_balance) {
      throw new Error(
        `Insufficient points: requested ${data.points}, available ${account.points_balance}`
      )
    }

    const txn = await this.createLoyaltyTransactions({
      account_id: account.id,
      type: "burn",
      points: -data.points,
      reference_type: "order",
      reference_id: data.order_id,
      reason: `Redeemed on order ${data.order_id}`,
    })

    const newBalance = account.points_balance - data.points

    await this.updateLoyaltyAccounts({
      id: account.id,
      points_balance: newBalance,
    })

    return { transaction: txn, new_balance: newBalance }
  }

  async expirePoints(daysOld: number = 365) {
    const cutoff = new Date()
    cutoff.setDate(cutoff.getDate() - daysOld)

    const accounts = await this.listLoyaltyAccounts(
      {},
      { take: null }
    )

    let expiredCount = 0
    let totalExpired = 0

    for (const account of accounts) {
      if (account.points_balance <= 0) continue

      // Find earn transactions older than cutoff that haven't been expired
      const oldTxns = await this.listLoyaltyTransactions({
        account_id: account.id,
        type: "earn",
      })

      const expirablePoints = oldTxns
        .filter((t: any) => new Date(t.created_at) < cutoff)
        .reduce((sum: number, t: any) => sum + t.points, 0)

      if (expirablePoints <= 0) continue

      const pointsToExpire = Math.min(expirablePoints, account.points_balance)

      await this.createLoyaltyTransactions({
        account_id: account.id,
        type: "expire",
        points: -pointsToExpire,
        reason: `Points expired (older than ${daysOld} days)`,
      })

      await this.updateLoyaltyAccounts({
        id: account.id,
        points_balance: account.points_balance - pointsToExpire,
      })

      expiredCount++
      totalExpired += pointsToExpire
    }

    return { accounts_affected: expiredCount, points_expired: totalExpired }
  }

  async calculateTier(customerId: string) {
    const [account] = await this.listLoyaltyAccounts({ customer_id: customerId })
    if (!account) return "bronze"

    const tier = this.computeTier(account.lifetime_points)

    if (tier !== account.tier) {
      await this.updateLoyaltyAccounts({ id: account.id, tier })
    }

    return tier
  }

  async generateReferralCode(customerId: string) {
    const [account] = await this.listLoyaltyAccounts({ customer_id: customerId })

    if (!account) {
      const newAccount = await this.createLoyaltyAccounts({
        customer_id: customerId,
        points_balance: 0,
        tier: "bronze",
        lifetime_points: 0,
        referral_code: this.makeReferralCode(),
      })
      return newAccount.referral_code
    }

    if (account.referral_code) return account.referral_code

    const code = this.makeReferralCode()
    await this.updateLoyaltyAccounts({ id: account.id, referral_code: code })
    return code
  }

  private computeTier(lifetimePoints: number): "bronze" | "silver" | "gold" | "platinum" {
    if (lifetimePoints >= TIER_THRESHOLDS.platinum) return "platinum"
    if (lifetimePoints >= TIER_THRESHOLDS.gold) return "gold"
    if (lifetimePoints >= TIER_THRESHOLDS.silver) return "silver"
    return "bronze"
  }

  private makeReferralCode(): string {
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"
    let code = "SM-"
    for (let i = 0; i < 6; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length))
    }
    return code
  }
}

export default LoyaltyModuleService
