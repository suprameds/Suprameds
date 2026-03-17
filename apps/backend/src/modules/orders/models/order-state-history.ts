import { model } from "@medusajs/framework/utils"

/**
 * OrderStateHistory — IMMUTABLE audit log of all order status transitions.
 */
const OrderStateHistory = model.define("order_state_history", {
  id: model.id().primaryKey(),
  order_id: model.text(),
  from_status: model.text(),
  to_status: model.text(),
  changed_by: model.text(),
  reason: model.text().nullable(),
  metadata: model.json().nullable(),
})

export default OrderStateHistory
