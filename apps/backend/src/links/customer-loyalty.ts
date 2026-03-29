import { defineLink } from "@medusajs/framework/utils"
import CustomerModule from "@medusajs/medusa/customer"
import LoyaltyModule from "../modules/loyalty"

/**
 * Read-only link: LoyaltyAccount.customer_id → Customer.id
 *
 * Enables query.graph traversal for customer→loyalty account:
 *   query.graph({ entity: "customer", fields: ["loyalty_account.*"] })
 */
export default defineLink(
  {
    linkable: LoyaltyModule.linkable.loyaltyAccount,
    field: "customer_id",
  },
  ((CustomerModule as any)?.linkable?.customer ??
    (CustomerModule as any)?.default?.linkable?.customer) as any,
  { readOnly: true }
)
