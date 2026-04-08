import { model } from "@medusajs/framework/utils"

/**
 * WalletAccount — customer refund wallet / site pay balance.
 * When orders are returned or cancelled, the refund amount goes here.
 * Customers can use the balance at checkout.
 */
const WalletAccount = model.define("wallet_account", {
  id: model.id().primaryKey(),

  customer_id: model.text().unique(),

  /** Balance in whole currency units (₹10 = 10, not 1000) */
  balance: model.number().default(0),

  currency_code: model.text().default("inr"),

  metadata: model.json().nullable(),
})

export default WalletAccount
