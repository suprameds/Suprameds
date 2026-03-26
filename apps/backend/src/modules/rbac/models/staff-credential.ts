import { model } from "@medusajs/framework/utils"

/**
 * StaffCredential — stores professional credentials for admin users.
 *
 * Used primarily for pharmacist registration numbers (mandated by
 * CDSCO for prescription approval, H1 register, and supply memos),
 * but extensible to any professional credential (e.g. doctor MCI).
 *
 * credential_type values:
 *   - pharmacist_registration  (State Pharmacy Council reg no.)
 *   - mci_registration         (Medical Council of India)
 *   - drug_license             (Drug License from State Drug Authority)
 */
const StaffCredential = model.define("staff_credential", {
  id: model.id().primaryKey(),

  user_id: model.text(),

  credential_type: model
    .enum([
      "pharmacist_registration",
      "mci_registration",
      "drug_license",
      "other",
    ]),

  credential_value: model.text(),

  holder_name: model.text(),

  issuing_authority: model.text().nullable(),

  valid_from: model.dateTime().nullable(),

  valid_until: model.dateTime().nullable(),

  is_verified: model.boolean().default(false),

  verified_by: model.text().nullable(),

  verified_at: model.dateTime().nullable(),

  metadata: model.json().nullable(),
})

export default StaffCredential
