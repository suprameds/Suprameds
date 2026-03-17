import { model } from "@medusajs/framework/utils"

/**
 * ShipmentItem — CDSCO batch traceability per item in shipment.
 * Mandatory batch proof for every shipped drug.
 */
const ShipmentItem = model.define("shipment_item", {
  id: model.id().primaryKey(),

  shipment_id: model.text(),
  order_item_id: model.text(),

  // Explicit batch proof — mandatory
  batch_id: model.text(),
  quantity_shipped: model.number(),

  // Denormalized for memo speed
  batch_number: model.text(),
  expiry_date: model.dateTime(),
})

export default ShipmentItem
