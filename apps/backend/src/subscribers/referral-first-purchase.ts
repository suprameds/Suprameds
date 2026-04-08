import type { SubscriberArgs, SubscriberConfig } from "@medusajs/framework"
import { Modules } from "@medusajs/framework/utils"
import { LOYALTY_MODULE } from "../modules/loyalty"
import { captureException } from "../lib/sentry"
import { createLogger } from "../lib/logger"

const logger = createLogger("subscriber:referral-first-purchase")

const REFERRER_BONUS_POINTS = 50

type PointsEarnedData = {
  customer_id: string
  order_id: string
  points_earned: number
}

/**
 * Listens to loyalty.points_earned events. When a referred customer
 * completes their first purchase (first earn transaction), awards
 * 50 bonus points to the referrer.
 */
export default async function referralFirstPurchaseHandler({
  event: { data },
  container,
}: SubscriberArgs<PointsEarnedData>) {
  const { customer_id, order_id } = data
  if (!customer_id) return

  try {
    const loyaltyService = container.resolve(LOYALTY_MODULE) as any

    // Check if this customer was referred
    const [account] = await loyaltyService.listLoyaltyAccounts(
      { customer_id },
      { take: 1 }
    )

    if (!account?.referred_by) return // Not a referred customer

    // Check if this is their first "earn" from an order (not referral bonus)
    const orderEarns = await loyaltyService.listLoyaltyTransactions(
      { account_id: account.id, type: "earn", reference_type: "order" },
      { take: 2 }
    )

    // If more than 1 order-based earn transaction, this isn't the first purchase
    if (orderEarns.length > 1) return

    // Find the referrer's account
    const [referrerAccount] = await loyaltyService.listLoyaltyAccounts(
      { referral_code: account.referred_by },
      { take: 1 }
    )

    if (!referrerAccount) {
      logger.warn(`Referrer account not found for code ${account.referred_by}`)
      return
    }

    // Check if referrer bonus was already awarded for this referee
    const existingBonus = await loyaltyService.listLoyaltyTransactions(
      {
        account_id: referrerAccount.id,
        type: "earn",
        reference_type: "referral_purchase",
        reference_id: customer_id,
      },
      { take: 1 }
    )

    if (existingBonus.length > 0) {
      logger.info(`Referrer bonus already awarded for customer ${customer_id}`)
      return
    }

    // Award bonus to referrer
    await loyaltyService.createLoyaltyTransactions({
      account_id: referrerAccount.id,
      type: "earn",
      points: REFERRER_BONUS_POINTS,
      reference_type: "referral_purchase",
      reference_id: customer_id,
      reason: `Referral bonus: your friend completed their first order`,
    })

    await loyaltyService.updateLoyaltyAccounts({
      id: referrerAccount.id,
      points_balance: referrerAccount.points_balance + REFERRER_BONUS_POINTS,
      lifetime_points: referrerAccount.lifetime_points + REFERRER_BONUS_POINTS,
    })

    logger.info(
      `Awarded ${REFERRER_BONUS_POINTS} referrer bonus to ${referrerAccount.customer_id} ` +
        `for referred customer ${customer_id}'s first purchase (order ${order_id})`
    )

    // Send push notification to referrer
    try {
      const eventBus = container.resolve(Modules.EVENT_BUS) as any
      await eventBus.emit({
        name: "loyalty.referral_bonus_earned",
        data: {
          customer_id: referrerAccount.customer_id,
          points_earned: REFERRER_BONUS_POINTS,
          referred_customer_id: customer_id,
        },
      })
    } catch {
      // Best-effort
    }
  } catch (err: any) {
    logger.error(`Referral first purchase handler failed: ${err.message}`)
    captureException(err, { subscriber: "referral-first-purchase", customerId: customer_id, orderId: order_id })
  }
}

export const config: SubscriberConfig = { event: "loyalty.points_earned" }
