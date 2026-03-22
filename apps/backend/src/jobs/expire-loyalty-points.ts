import { MedusaContainer } from "@medusajs/framework/types"
import { LOYALTY_MODULE } from "../modules/loyalty"

const LOG_PREFIX = "[job:expire-loyalty]"
const EXPIRY_MONTHS = 12

/**
 * Daily job: expires loyalty points older than 12 months.
 * Creates expire transactions and decrements balances.
 */
export default async function ExpireLoyaltyPointsJob(container: MedusaContainer) {
  const logger = container.resolve("logger") as any
  const loyaltyService = container.resolve(LOYALTY_MODULE) as any

  logger.info(`${LOG_PREFIX} Starting loyalty points expiry scan`)

  const cutoffDate = new Date()
  cutoffDate.setMonth(cutoffDate.getMonth() - EXPIRY_MONTHS)

  let expiredCount = 0
  let totalExpiredPoints = 0

  try {
    // Find all earn transactions older than the cutoff that haven't been expired yet
    const earnTransactions = await loyaltyService.listLoyaltyTransactions(
      { type: "earn" },
      { take: null }
    )

    // Group unexpired earn transactions by account
    const accountExpiries = new Map<string, number>()

    for (const tx of earnTransactions) {
      const txDate = new Date(tx.created_at)
      if (txDate >= cutoffDate) continue
      if (tx.points <= 0) continue

      // Check if this transaction was already expired
      const [alreadyExpired] = await loyaltyService.listLoyaltyTransactions(
        {
          type: "expire",
          reference_type: "earn_expiry",
          reference_id: tx.id,
        },
        { take: 1 }
      )

      if (alreadyExpired) continue

      // Create expiry transaction for this earn
      await loyaltyService.createLoyaltyTransactions({
        account_id: tx.account_id,
        type: "expire",
        points: -tx.points,
        reference_type: "earn_expiry",
        reference_id: tx.id,
        reason: `Points from ${txDate.toISOString().slice(0, 10)} expired (${EXPIRY_MONTHS}-month policy)`,
      })

      const current = accountExpiries.get(tx.account_id) ?? 0
      accountExpiries.set(tx.account_id, current + tx.points)

      expiredCount++
      totalExpiredPoints += tx.points
    }

    // Deduct expired points from each account balance
    for (const [accountId, pointsToDeduct] of accountExpiries) {
      try {
        const account = await loyaltyService.retrieveLoyaltyAccount(accountId)
        const newBalance = Math.max(0, account.points_balance - pointsToDeduct)

        await loyaltyService.updateLoyaltyAccounts(accountId, {
          points_balance: newBalance,
        })

        logger.info(
          `${LOG_PREFIX} Account ${accountId}: expired ${pointsToDeduct} points, ` +
            `balance ${account.points_balance} → ${newBalance}`
        )
      } catch (err) {
        logger.error(`${LOG_PREFIX} Failed to update account ${accountId}: ${err}`)
      }
    }

    logger.info(
      `${LOG_PREFIX} Completed: ${expiredCount} transactions expired, ` +
        `${totalExpiredPoints} total points, ${accountExpiries.size} accounts affected`
    )
  } catch (err) {
    logger.error(`${LOG_PREFIX} Job failed: ${err}`)
    throw err
  }
}

export const config = {
  name: "expire-loyalty",
  schedule: "0 4 * * *", // Daily at 4:00 AM IST
}
