import { model } from "@medusajs/framework/utils"

/**
 * PharmacistNote — clinical notes on prescriptions (PHI — encrypted at rest).
 */
const PharmacistNote = model.define("pharmacist_note", {
  id: model.id().primaryKey(),

  prescription_id: model.text(),
  line_id: model.text().nullable(),
  pharmacist_id: model.text(),

  // Encrypted at rest
  note_text: model.text(),
})

export default PharmacistNote
