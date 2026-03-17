import { model } from "@medusajs/framework/utils"

/**
 * CsPlacedOrder — audit record when CS agent places order on behalf of customer.
 */
const CsPlacedOrder = model.define("cs_placed_order", {
  id: model.id().primaryKey(),
  order_id: model.text(),
  agent_id: model.text(),
  customer_id: model.text().nullable(),
  customer_phone: model.text(),
  channel: model.enum(["whatsapp", "phone", "email", "walk_in"]),
  payment_method: model.enum(["cod", "payment_link", "prepaid_existing"]),
  payment_link_id: model.text().nullable(),
  notes: model.text().nullable(),
})

export default CsPlacedOrder
