import { model } from "@medusajs/framework/utils"

/**
 * WarehouseBin — individual storage locations within zones.
 */
const WarehouseBin = model.define("warehouse_bin", {
  id: model.id().primaryKey(),
  zone_id: model.text(),
  bin_code: model.text(),
  bin_barcode: model.text(),
  capacity_units: model.number().default(0),
  current_units: model.number().default(0),
  is_active: model.boolean().default(true),
  last_audit_at: model.dateTime().nullable(),
})

export default WarehouseBin
