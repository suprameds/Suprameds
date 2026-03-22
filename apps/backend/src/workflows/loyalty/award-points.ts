import {
  createStep,
  createWorkflow,
  StepResponse,
  WorkflowResponse,
} from "@medusajs/framework/workflows-sdk"
import { Modules } from "@medusajs/framework/utils"
import { LOYALTY_MODULE } from "../../modules/loyalty"
import { PHARMA_MODULE } from "../../modules/pharma"

// Tier thresholds based on lifetime points
const TIER_THRESHOLDS = {
  platinum: 5000,
  gold: 2000,
  silver: 500,
  bronze: 0,
} as const

type Tier = "bronze" | "silver" | "gold" | "platinum"

type AwardPointsInput = {
  customer_id: string
  order_id: string
  order_total: number
}

/**
 * Validates the customer exists and fetches/creates their loyalty account.
 */
const validateCustomerStep = createStep(
  "award-points-validate-customer",
  async (input: { customer_id: string }, { container }) => {
    const logger = container.resolve("logger") as any
    const loyaltyService = container.resolve(LOYALTY_MODULE) as any

    // Ensure the customer actually exists in Medusa
    const customerService = container.resolve(Modules.CUSTOMER) as any
    const customer = await customerService.retrieveCustomer(input.customer_id)
    if (!customer) {
      throw new Error(`Customer ${input.customer_id} not found`)
    }

    // Fetch or create loyalty account
    const [existing] = await loyaltyService.listLoyaltyAccounts(
      { customer_id: input.customer_id },
      { take: 1 }
    )

    if (existing) {
      return new StepResponse({ account: existing, is_first_order: false })
    }

    const account = await loyaltyService.createLoyaltyAccounts({
      customer_id: input.customer_id,
      points_balance: 0,
      lifetime_points: 0,
      tier: "bronze",
    })

    logger.info(`[loyalty] Created new loyalty account for customer ${input.customer_id}`)
    return new StepResponse({ account, is_first_order: true })
  }
)

/**
 * Calculates points to award: 1 point per ₹10 spent on OTC items only.
 * Bonuses: 2x for first order, 1.5x for Gold/Platinum tier.
 * Compliance: Rx drugs (H/H1/X) NEVER earn loyalty points.
 */
const calculatePointsStep = createStep(
  "award-points-calculate",
  async (
    input: {
      order_id: string
      order_total: number
      account: any
      is_first_order: boolean
    },
    { container }
  ) => {
    const logger = container.resolve("logger") as any
    const orderService = container.resolve(Modules.ORDER) as any
    const pharmaService = container.resolve(PHARMA_MODULE) as any

    const order = await orderService.retrieveOrder(input.order_id, {
      relations: ["items"],
    })

    // Sum only OTC line item totals — exclude Rx drugs per compliance
    let otcTotal = 0

    for (const item of order.items ?? []) {
      const productId = item.product_id
      if (!productId) {
        otcTotal += Number(item.unit_price) * item.quantity
        continue
      }

      const [drugProduct] = await pharmaService.listDrugProducts({ product_id: productId })
      const schedule = drugProduct?.schedule ?? "OTC"

      if (schedule === "OTC") {
        otcTotal += Number(item.unit_price) * item.quantity
      } else {
        logger.info(`[loyalty] Skipping Rx item ${productId} (schedule: ${schedule}) for points`)
      }
    }

    if (otcTotal <= 0) {
      logger.info(`[loyalty] No OTC items in order ${input.order_id} — zero points`)
      return new StepResponse({ base_points: 0, bonus_multiplier: 1, total_points: 0, otc_total: 0 })
    }

    // 1 point per ₹10 spent (Medusa stores amounts in whole units for INR)
    const basePoints = Math.floor(otcTotal / 10)

    // Determine bonus multiplier
    let bonusMultiplier = 1
    if (input.is_first_order) {
      bonusMultiplier = 2
    } else if (input.account.tier === "gold" || input.account.tier === "platinum") {
      bonusMultiplier = 1.5
    }

    const totalPoints = Math.floor(basePoints * bonusMultiplier)

    logger.info(
      `[loyalty] Order ${input.order_id}: OTC total ₹${otcTotal}, ` +
        `base=${basePoints}, multiplier=${bonusMultiplier}, total=${totalPoints}`
    )

    return new StepResponse({
      base_points: basePoints,
      bonus_multiplier: bonusMultiplier,
      total_points: totalPoints,
      otc_total: otcTotal,
    })
  }
)

/**
 * Credits the calculated points to the customer's loyalty account.
 */
const creditPointsStep = createStep(
  "award-points-credit",
  async (
    input: { account_id: string; points: number; order_id: string },
    { container }
  ) => {
    if (input.points <= 0) {
      return new StepResponse({ transaction: null, updated_account: null })
    }

    const loyaltyService = container.resolve(LOYALTY_MODULE) as any

    // Create earn transaction
    const transaction = await loyaltyService.createLoyaltyTransactions({
      account_id: input.account_id,
      type: "earn",
      points: input.points,
      reference_type: "order",
      reference_id: input.order_id,
      reason: `Points earned from order ${input.order_id}`,
    })

    // Retrieve current account state for atomic update
    const account = await loyaltyService.retrieveLoyaltyAccount(input.account_id)
    const updatedAccount = await loyaltyService.updateLoyaltyAccounts(input.account_id, {
      points_balance: account.points_balance + input.points,
      lifetime_points: account.lifetime_points + input.points,
    })

    return new StepResponse(
      { transaction, updated_account: updatedAccount },
      transaction.id
    )
  },
  // Compensation: reverse the earn transaction on rollback
  async (transactionId, { container }) => {
    if (!transactionId) return
    const loyaltyService = container.resolve(LOYALTY_MODULE) as any
    try {
      const tx = await loyaltyService.retrieveLoyaltyTransaction(transactionId)
      if (tx) {
        const account = await loyaltyService.retrieveLoyaltyAccount(tx.account_id)
        await loyaltyService.updateLoyaltyAccounts(tx.account_id, {
          points_balance: account.points_balance - tx.points,
          lifetime_points: account.lifetime_points - tx.points,
        })
        await loyaltyService.deleteLoyaltyTransactions(transactionId)
      }
    } catch {
      // Best-effort compensation
    }
  }
)

/**
 * Recalculates and updates the customer's tier based on lifetime points.
 */
const updateTierStep = createStep(
  "award-points-update-tier",
  async (input: { account_id: string }, { container }) => {
    const loyaltyService = container.resolve(LOYALTY_MODULE) as any
    const logger = container.resolve("logger") as any

    const account = await loyaltyService.retrieveLoyaltyAccount(input.account_id)
    const lifetime = account.lifetime_points

    let newTier: Tier = "bronze"
    if (lifetime >= TIER_THRESHOLDS.platinum) newTier = "platinum"
    else if (lifetime >= TIER_THRESHOLDS.gold) newTier = "gold"
    else if (lifetime >= TIER_THRESHOLDS.silver) newTier = "silver"

    if (newTier !== account.tier) {
      await loyaltyService.updateLoyaltyAccounts(input.account_id, { tier: newTier })
      logger.info(`[loyalty] Customer tier upgraded: ${account.tier} → ${newTier}`)
    }

    return new StepResponse({ previous_tier: account.tier, new_tier: newTier })
  }
)

/**
 * Emits loyalty.points_earned event for downstream subscribers (push notifications, etc.).
 */
const emitPointsEarnedStep = createStep(
  "award-points-emit-event",
  async (
    input: {
      customer_id: string
      order_id: string
      points: number
      new_tier: string
      previous_tier: string
    },
    { container }
  ) => {
    if (input.points <= 0) return new StepResponse(null)

    const eventBus = container.resolve(Modules.EVENT_BUS) as any
    await eventBus.emit({
      name: "loyalty.points_earned",
      data: {
        customer_id: input.customer_id,
        order_id: input.order_id,
        points: input.points,
        new_tier: input.new_tier,
        previous_tier: input.previous_tier,
      },
    })

    return new StepResponse(null)
  }
)

/**
 * AwardPointsWorkflow — awards loyalty points after a completed OTC order.
 * 1 point per ₹10 spent (OTC only — Rx drugs never earn points per compliance).
 * Bonuses: 2x for first order, 1.5x for Gold/Platinum tier.
 */
export const AwardPointsWorkflow = createWorkflow(
  "award-points-workflow",
  (input: AwardPointsInput) => {
    const { account, is_first_order } = validateCustomerStep({
      customer_id: input.customer_id,
    }) as any

    const { total_points } = calculatePointsStep({
      order_id: input.order_id,
      order_total: input.order_total,
      account,
      is_first_order,
    }) as any

    creditPointsStep({
      account_id: account.id,
      points: total_points,
      order_id: input.order_id,
    })

    const { new_tier, previous_tier } = updateTierStep({
      account_id: account.id,
    }) as any

    emitPointsEarnedStep({
      customer_id: input.customer_id,
      order_id: input.order_id,
      points: total_points,
      new_tier,
      previous_tier,
    })

    return new WorkflowResponse({
      customer_id: input.customer_id,
      order_id: input.order_id,
      points_awarded: total_points,
      new_tier,
      previous_tier,
    })
  }
)
