import { model } from "@medusajs/framework/utils"

/**
 * PartialShipmentPreference — customer's choice when OOS items detected.
 */
const PartialShipmentPreference = model.define("partial_shipment_preference", {
  id: model.id().primaryKey(),
  order_id: model.text(),
  customer_id: model.text(),
  choice: model.enum(["ship_available", "wait_for_all", "cancel_oos_item"]),
  oos_items: model.json(),
  chosen_at: model.dateTime(),
})

export default PartialShipmentPreference
