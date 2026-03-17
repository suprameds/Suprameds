import { model } from "@medusajs/framework/utils"

/**
 * ChronicReorderPattern — detected recurring purchase patterns for reorder reminders.
 * Computed nightly from order history for chronic medication customers.
 */
const ChronicReorderPattern = model.define("chronic_reorder_pattern", {
  id: model.id().primaryKey(),

  customer_id: model.text(),
  variant_id: model.text(),

  // Computed from order history
  average_days_between_orders: model.number(),
  last_purchased_at: model.dateTime(),
  next_expected_at: model.dateTime(),

  // Reminder tracking
  reminder_sent_at: model.dateTime().nullable(),

  // 0-100, based on consistency of pattern
  confidence_score: model.number().default(0),
  is_active: model.boolean().default(true),

  detected_at: model.dateTime(),
})

export default ChronicReorderPattern
