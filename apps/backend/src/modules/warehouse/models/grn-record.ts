import { model } from "@medusajs/framework/utils"

/**
 * GrnRecord — Goods Receipt Note (CDSCO 5-year retention).
 */
const GrnRecord = model.define("grn_record", {
  id: model.id().primaryKey(),
  grn_number: model.text().unique(),
  supplier_id: model.text(),
  supplier_invoice_no: model.text(),
  received_by: model.text(),
  qc_approved_by: model.text().nullable(),
  received_at: model.dateTime(),
  qc_approved_at: model.dateTime().nullable(),
  items: model.json(),
  status: model.enum(["pending_qc", "approved", "partially_rejected", "rejected"]).default("pending_qc"),
})

export default GrnRecord
