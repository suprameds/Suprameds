import { model } from "@medusajs/framework/utils"

/**
 * DispenseDecision — pharmacist clinical decision per prescription line.
 * Authorizes fulfillment of a specific drug item.
 * Must be linked to H1RegisterEntry for Schedule H1 drugs.
 */
const DispenseDecision = model.define("dispense_decision", {
  id: model.id().primaryKey(),

  prescription_drug_line_id: model.text(),

  // Must be pharmacist role — DB enforced
  pharmacist_id: model.text(),

  decision: model.enum([
    "approved",
    "rejected",
    "substituted",
    "quantity_modified",
  ]),

  approved_variant_id: model.text().nullable(),
  approved_quantity: model.number().default(0),
  dispensing_notes: model.text().nullable(),

  rejection_reason: model.enum([
    "out_of_stock",
    "contraindication",
    "interaction_risk",
    "invalid_rx",
    "schedule_restriction",
    "other",
  ]).nullable(),

  // Mandatory for Schedule H1
  h1_register_entry_id: model.text().nullable(),

  decided_at: model.dateTime(),

  is_override: model.boolean().default(false),
  override_reason: model.text().nullable(),

  metadata: model.json().nullable(),
})

export default DispenseDecision
