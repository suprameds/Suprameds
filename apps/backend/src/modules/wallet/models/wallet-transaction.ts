import { model } from "@medusajs/framework/utils"

/**
 * WalletTransaction — ledger entry for wallet credits and debits.
 * Every change to a wallet balance is recorded here for auditability.
 */
const WalletTransaction = model.define("wallet_transaction", {
  id: model.id().primaryKey(),

  account_id: model.text(),

  /** credit = money added, debit = money spent */
  type: model.enum(["credit", "debit"]),

  /** Always positive — direction is indicated by `type` */
  amount: model.number(),

  /** What triggered this transaction */
  reference_type: model.enum(["return", "cancellation", "manual", "checkout"]),

  reference_id: model.text().nullable(),

  reason: model.text().nullable(),

  metadata: model.json().nullable(),
})

export default WalletTransaction
