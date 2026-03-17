import { MedusaService } from "@medusajs/framework/utils"
import LoyaltyAccount from "./models/loyalty-account"
import LoyaltyTransaction from "./models/loyalty-transaction"

/**
 * LoyaltyModuleService — Points, tiers, referrals.
 * HARD RULE: OTC orders ONLY — Rx orders NEVER earn/burn points.
 */
class LoyaltyModuleService extends MedusaService({
  LoyaltyAccount,
  LoyaltyTransaction,
}) {
  // TODO: earnPoints(), burnPoints(), expirePoints(),
  //       calculateTier(), generateReferralCode()
}

export default LoyaltyModuleService
