import { model } from "@medusajs/framework/utils"

/**
 * CodCustomerScore — fraud + RTO prevention scoring for COD orders.
 *
 * Rules:
 *   1 RTO → COD limit reduced to ₹500 max
 *   2 consecutive RTOs → COD disabled, show prepaid incentive
 *   New customers → COD available up to ₹1000
 */
const CodCustomerScore = model.define("cod_customer_score", {
  id: model.id().primaryKey(),

  customer_id: model.text().unique(),

  total_cod_orders: model.number().default(0),
  cod_rto_count: model.number().default(0),

  // rto_count / total_cod_orders
  cod_rto_rate: model.float().default(0),

  // RTOs in last N orders
  consecutive_rtos: model.number().default(0),

  // false after 2+ consecutive RTOs
  cod_eligible: model.boolean().default(true),

  // Max order value for COD (reduce after 1 RTO)
  cod_limit: model.number().default(1000),

  last_evaluated_at: model.dateTime().nullable(),
})

export default CodCustomerScore
