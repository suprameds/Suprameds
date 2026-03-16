import { model } from "@medusajs/framework/utils"
import Batch from "./batch"

/**
 * BatchDeduction — tracks exactly which batch units were used for which order line item.
 *
 * Enforces traceability: every deduction must be linked to an order line item.
 * Supports FEFO audit: warehouse can prove what batch was dispensed for each order.
 */
const BatchDeduction = model.define("batch_deduction", {
  id: model.id().primaryKey(),

  batch: model.belongsTo(() => Batch, {
    mappedBy: "deductions",
  }),

  // Medusa order line item ID
  order_line_item_id: model.text(),

  // Medusa order ID (denormalized for reporting)
  order_id: model.text(),

  // Units deducted from this batch for this line item
  quantity: model.number(),

  // Deduction type: sale | return | adjustment | write_off
  deduction_type: model
    .enum(["sale", "return", "adjustment", "write_off"])
    .default("sale"),

  // Who performed the deduction (warehouse staff Medusa user ID)
  deducted_by: model.text().nullable(),

  metadata: model.json().nullable(),
})

export default BatchDeduction
