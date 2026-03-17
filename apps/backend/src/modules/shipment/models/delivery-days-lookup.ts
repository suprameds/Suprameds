import { model } from "@medusajs/framework/utils"

/**
 * DeliveryDaysLookup — state-wise EDD table for India Post.
 * Populated once as seed data. Zero API calls for delivery estimates.
 */
const DeliveryDaysLookup = model.define("delivery_days_lookup", {
  id: model.id().primaryKey(),

  // Your warehouse state (e.g. "Telangana")
  origin_state: model.text(),

  // Customer's state
  dest_state: model.text(),

  // metro | tier2 | tier3 | rural
  city_type: model.enum(["metro", "tier2", "tier3", "rural"]).default("metro"),

  min_days: model.number(),
  max_days: model.number(),

  // e.g. "2-4 business days"
  display_text: model.text(),
})

export default DeliveryDaysLookup
