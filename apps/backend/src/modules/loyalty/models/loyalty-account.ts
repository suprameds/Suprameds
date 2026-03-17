import { model } from "@medusajs/framework/utils"

/**
 * LoyaltyAccount — customer loyalty points balance and tier.
 * HARD RULE: Loyalty points apply to OTC orders ONLY — never Rx.
 */
const LoyaltyAccount = model.define("loyalty_account", {
  id: model.id().primaryKey(),

  customer_id: model.text().unique(),

  points_balance: model.number().default(0),

  // bronze | silver | gold | platinum
  tier: model.enum(["bronze", "silver", "gold", "platinum"]).default("bronze"),

  lifetime_points: model.number().default(0),

  // Referral tracking
  referral_code: model.text().nullable(),
  referred_by: model.text().nullable(),

  metadata: model.json().nullable(),
})

export default LoyaltyAccount
