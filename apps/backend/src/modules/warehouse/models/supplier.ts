import { model } from "@medusajs/framework/utils"

/**
 * Supplier — drug suppliers/distributors.
 */
const Supplier = model.define("supplier", {
  id: model.id().primaryKey(),
  supplier_name: model.text(),
  drug_license_no: model.text(),
  gst_number: model.text(),
  contact_person: model.text().nullable(),
  phone: model.text().nullable(),
  email: model.text().nullable(),
  address: model.json().nullable(),
  payment_terms: model.text().nullable(),
  is_active: model.boolean().default(true),
})

export default Supplier
