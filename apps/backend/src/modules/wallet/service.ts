import { MedusaService } from "@medusajs/framework/utils"
import WalletAccount from "./models/wallet-account"
import WalletTransaction from "./models/wallet-transaction"

class WalletModuleService extends MedusaService({
  WalletAccount,
  WalletTransaction,
}) {
  /**
   * Find or create a wallet account for the given customer.
   */
  async getOrCreateAccount(customerId: string) {
    const [existing] = await this.listWalletAccounts({ customer_id: customerId })

    if (existing) return existing

    return await this.createWalletAccounts({
      customer_id: customerId,
      balance: 0,
      currency_code: "inr",
    })
  }

  /**
   * Credit (add) money to a customer's wallet.
   * Creates a transaction record and updates the balance.
   */
  async creditWallet(
    customerId: string,
    amount: number,
    referenceType: "return" | "cancellation" | "manual",
    referenceId: string | null,
    reason: string
  ) {
    if (amount <= 0) {
      throw new Error("Credit amount must be positive")
    }

    const account = await this.getOrCreateAccount(customerId)

    const txn = await this.createWalletTransactions({
      account_id: account.id,
      type: "credit",
      amount,
      reference_type: referenceType,
      reference_id: referenceId,
      reason,
    })

    const newBalance = account.balance + amount

    await this.updateWalletAccounts({
      id: account.id,
      balance: newBalance,
    })

    return { transaction: txn, new_balance: newBalance }
  }

  /**
   * Debit (subtract) money from a customer's wallet.
   * Throws if insufficient balance.
   */
  async debitWallet(
    customerId: string,
    amount: number,
    referenceType: "checkout" | "manual",
    referenceId: string | null,
    reason: string
  ) {
    if (amount <= 0) {
      throw new Error("Debit amount must be positive")
    }

    const account = await this.getOrCreateAccount(customerId)

    if (amount > account.balance) {
      throw new Error(
        `Insufficient wallet balance: requested ₹${amount}, available ₹${account.balance}`
      )
    }

    const txn = await this.createWalletTransactions({
      account_id: account.id,
      type: "debit",
      amount,
      reference_type: referenceType,
      reference_id: referenceId,
      reason,
    })

    const newBalance = account.balance - amount

    await this.updateWalletAccounts({
      id: account.id,
      balance: newBalance,
    })

    return { transaction: txn, new_balance: newBalance }
  }

  /**
   * Get balance for a customer (returns 0 if no account exists).
   */
  async getBalance(customerId: string): Promise<number> {
    const [account] = await this.listWalletAccounts({ customer_id: customerId })
    return account?.balance ?? 0
  }

  /**
   * List transactions for a customer with pagination.
   */
  async getTransactions(customerId: string, limit = 20, offset = 0) {
    const account = await this.getOrCreateAccount(customerId)

    return this.listWalletTransactions(
      { account_id: account.id },
      { order: { created_at: "DESC" }, take: limit, skip: offset }
    )
  }
}

export default WalletModuleService
