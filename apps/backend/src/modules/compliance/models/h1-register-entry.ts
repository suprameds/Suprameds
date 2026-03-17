import { model } from "@medusajs/framework/utils"

/**
 * H1RegisterEntry — CDSCO mandatory register for every Schedule H1 dispense.
 * Must be written in SAME TRANSACTION as dispense decision.
 */
const H1RegisterEntry = model.define("h1_register_entry", {
  id: model.id().primaryKey(),
  entry_date: model.dateTime(),
  // Patient details (encrypted PHI)
  patient_name: model.text(),
  patient_address: model.text(),
  patient_age: model.number(),
  // Prescriber details
  prescriber_name: model.text(),
  prescriber_reg_no: model.text(),
  // Drug details
  drug_name: model.text(),
  brand_name: model.text(),
  batch_number: model.text(),
  quantity_dispensed: model.number(),
  // Pharmacist
  dispensing_pharmacist: model.text(),
  pharmacist_reg_no: model.text(),
  // References
  order_item_id: model.text(),
  dispense_decision_id: model.text(),
})

export default H1RegisterEntry
