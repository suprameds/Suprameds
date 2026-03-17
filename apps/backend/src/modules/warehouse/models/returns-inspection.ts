import { model } from "@medusajs/framework/utils"

/**
 * ReturnsInspection — inspection record for returned items.
 */
const ReturnsInspection = model.define("returns_inspection", {
  id: model.id().primaryKey(),
  order_item_id: model.text(),
  batch_id: model.text(),
  return_reason: model.enum(["wrong_product", "damaged", "recalled", "near_expiry", "other"]),
  result: model.enum(["saleable", "damaged", "opened", "near_expiry", "recalled", "doubtful"]),
  action_taken: model.enum(["restocked", "quarantined", "destroyed"]),
  approved_by: model.text(),
  evidence_urls: model.json().nullable(),
  inspected_at: model.dateTime(),
})

export default ReturnsInspection
