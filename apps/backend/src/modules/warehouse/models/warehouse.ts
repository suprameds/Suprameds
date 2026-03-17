import { model } from "@medusajs/framework/utils"

/**
 * Warehouse — single ambient warehouse for Suprameds.
 */
const Warehouse = model.define("warehouse", {
  id: model.id().primaryKey(),
  name: model.text(),
  code: model.text().unique(),
  drug_license_no: model.text(),
  gst_registration: model.text(),
  manager_id: model.text(),
  address: model.json().nullable(),
  is_active: model.boolean().default(true),
})

export default Warehouse
