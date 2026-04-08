import type { SubscriberArgs, SubscriberConfig } from "@medusajs/framework"
import { Modules } from "@medusajs/framework/utils"
import { LOYALTY_MODULE } from "../modules/loyalty"
import { captureException } from "../lib/sentry"
import { createLogger } from "../lib/logger"

const logger = createLogger("subscriber:customer-created")

const REFERRAL_SIGNUP_BONUS = 50

/**
 * Fires when a new customer registers on the storefront.
 *
 * 1. Sends a welcome email
 * 2. Auto-generates a referral code for the new customer
 * 3. If referred by someone, awards 50 bonus points to the new customer
 */
export default async function customerCreatedHandler({
  event: { data },
  container,
}: SubscriberArgs<{ id: string }>) {
  const customerId = data.id
  if (!customerId) return

  logger.info(`New customer: ${customerId}`)

  let customer: any
  try {
    const customerService = container.resolve(Modules.CUSTOMER) as any
    customer = await customerService.retrieveCustomer(customerId)

    if (!customer?.email) {
      logger.warn(`Customer ${customerId} has no email — skipping welcome`)
      return
    }

    // 1. Send welcome email
    try {
      const notificationService = container.resolve("notification") as any
      await notificationService.createNotifications({
        to: customer.email,
        channel: "email",
        template: "welcome",
        data: {
          first_name: customer.first_name || "",
          email: customer.email,
        },
      })
      logger.info(`Welcome email queued for ${customer.email}`)
    } catch (err) {
      logger.warn(
        `Welcome email failed for ${customer.email}: ${(err as Error).message}`
      )
      captureException(err, { subscriber: "customer-created", customerId, step: "send-welcome-email" })
    }
  } catch (err) {
    logger.error(`Failed for customer ${customerId}: ${(err as Error).message}`)
    captureException(err, { subscriber: "customer-created", customerId })
    return
  }

  // 2. Auto-generate referral code for the new customer
  try {
    const loyaltyService = container.resolve(LOYALTY_MODULE) as any
    const code = await loyaltyService.generateReferralCode(customerId)
    logger.info(`Generated referral code ${code} for customer ${customerId}`)
  } catch (err) {
    logger.warn(`Referral code generation failed: ${(err as Error).message}`)
    captureException(err, { subscriber: "customer-created", customerId, step: "generate-referral-code" })
  }

  // 3. Process referral if customer was referred
  const referredBy = (customer.metadata as any)?.referred_by as string | undefined
  if (!referredBy) return

  try {
    const loyaltyService = container.resolve(LOYALTY_MODULE) as any

    // Validate the referral code exists
    const [referrerAccount] = await loyaltyService.listLoyaltyAccounts(
      { referral_code: referredBy.toUpperCase() },
      { take: 1 }
    )

    if (!referrerAccount) {
      logger.warn(`Invalid referral code "${referredBy}" for customer ${customerId}`)
      return
    }

    // Set referred_by on the new customer's loyalty account
    const [newAccount] = await loyaltyService.listLoyaltyAccounts(
      { customer_id: customerId },
      { take: 1 }
    )

    if (newAccount) {
      await loyaltyService.updateLoyaltyAccounts({
        id: newAccount.id,
        referred_by: referredBy.toUpperCase(),
      })
    }

    // Award 50 welcome bonus points to the new customer
    if (newAccount && REFERRAL_SIGNUP_BONUS > 0) {
      await loyaltyService.createLoyaltyTransactions({
        account_id: newAccount.id,
        type: "earn",
        points: REFERRAL_SIGNUP_BONUS,
        reference_type: "referral",
        reference_id: referrerAccount.customer_id,
        reason: `Welcome bonus: referred by ${referredBy}`,
      })

      await loyaltyService.updateLoyaltyAccounts({
        id: newAccount.id,
        points_balance: newAccount.points_balance + REFERRAL_SIGNUP_BONUS,
        lifetime_points: newAccount.lifetime_points + REFERRAL_SIGNUP_BONUS,
      })

      logger.info(
        `Awarded ${REFERRAL_SIGNUP_BONUS} referral bonus points to customer ${customerId} ` +
          `(referred by ${referredBy})`
      )
    }

    // Emit event for analytics
    try {
      const eventBus = container.resolve(Modules.EVENT_BUS) as any
      await eventBus.emit({
        name: "loyalty.referral_signup",
        data: {
          customer_id: customerId,
          referrer_customer_id: referrerAccount.customer_id,
          referral_code: referredBy,
          bonus_points: REFERRAL_SIGNUP_BONUS,
        },
      })
    } catch {
      // Best-effort event
    }
  } catch (err) {
    logger.error(`Referral processing failed for ${customerId}: ${(err as Error).message}`)
    captureException(err, { subscriber: "customer-created", customerId, step: "process-referral" })
  }
}

export const config: SubscriberConfig = { event: "customer.created" }
