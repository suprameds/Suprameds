import { model } from "@medusajs/framework/utils"

/**
 * LoyaltyTransaction — ledger entry for points earn/burn/expire/adjust.
 */
const LoyaltyTransaction = model.define("loyalty_transaction", {
  id: model.id().primaryKey(),

  account_id: model.text(),

  // earn | burn | expire | adjust
  type: model.enum(["earn", "burn", "expire", "adjust"]),

  // Positive for earn, negative for burn/expire
  points: model.number(),

  // What triggered this transaction
  reference_type: model.text().nullable(),
  reference_id: model.text().nullable(),

  reason: model.text().nullable(),

  metadata: model.json().nullable(),
})

export default LoyaltyTransaction
