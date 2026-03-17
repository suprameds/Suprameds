import { model } from "@medusajs/framework/utils"

/**
 * SupplyMemo — CDSCO mandatory cash/credit memo for every drug supply.
 * Generated per shipment (one memo per shipment for partial fulfillment).
 */
const SupplyMemo = model.define("supply_memo", {
  id: model.id().primaryKey(),

  // EPHM-YYYY-XXXXXX (sequential)
  memo_number: model.text().unique(),

  order_id: model.text(),

  // If partial shipment: one memo per shipment
  shipment_id: model.text().nullable(),

  // Customer details
  customer_name: model.text(),
  customer_address: model.text(),

  // Prescription reference
  prescription_ref: model.text().nullable(),

  // Pharmacist details
  pharmacist_name: model.text(),
  pharmacist_reg: model.text(),
  pharmacy_license: model.text(),

  // Line items as JSON array
  items: model.json(),

  // Totals
  total_mrp: model.number().default(0),
  total_discount: model.number().default(0),
  total_gst: model.number().default(0),
  total_payable: model.number().default(0),

  payment_mode: model.text(),

  generated_at: model.dateTime(),

  metadata: model.json().nullable(),
})

export default SupplyMemo
