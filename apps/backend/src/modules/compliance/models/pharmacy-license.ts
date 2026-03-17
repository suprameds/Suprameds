import { model } from "@medusajs/framework/utils"

/**
 * PharmacyLicense — license registry with expiry tracking.
 */
const PharmacyLicense = model.define("pharmacy_license", {
  id: model.id().primaryKey(),
  license_number: model.text().unique(),
  license_type: model.text(),
  issued_by: model.text(),
  valid_from: model.dateTime(),
  valid_until: model.dateTime(),
  document_url: model.text().nullable(),
  is_active: model.boolean().default(true),
  metadata: model.json().nullable(),
})

export default PharmacyLicense
