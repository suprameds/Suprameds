import { model } from "@medusajs/framework/utils"

/**
 * PharmacistAdjustmentLog — IMMUTABLE audit trail of all pharmacist adjustments.
 * Every quantity change, substitution, or override is logged here.
 */
const PharmacistAdjustmentLog = model.define("pharmacist_adjustment_log", {
  id: model.id().primaryKey(),

  order_item_id: model.text(),
  pharmacist_id: model.text(),

  adjustment_type: model.enum([
    "quantity_change",
    "substitution",
    "rejection",
    "schedule_override",
    "interaction_override",
    "pre_dispatch_approval",
  ]),

  // JSON snapshots
  previous_value: model.text(),
  new_value: model.text(),

  // Mandatory, minimum 10 characters
  reason: model.text(),
})

export default PharmacistAdjustmentLog
