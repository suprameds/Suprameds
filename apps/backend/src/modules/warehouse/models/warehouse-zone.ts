import { model } from "@medusajs/framework/utils"

/**
 * WarehouseZone — ambient only (no cold chain).
 * controlled_access = Schedule H1 drugs (locked, dual-key access).
 */
const WarehouseZone = model.define("warehouse_zone", {
  id: model.id().primaryKey(),
  warehouse_id: model.text(),
  zone_code: model.text(),
  zone_type: model.enum([
    "ambient",
    "quarantine",
    "controlled_access",
    "receiving",
    "dispatch",
    "returns",
  ]),
  access_level: model.enum(["open", "pharmacist_key", "dual_key"]).default("open"),
})

export default WarehouseZone
