import { model } from "@medusajs/framework/utils"

/**
 * PhiAuditLog — IMMUTABLE PHI access audit log, partitioned monthly.
 * Required for CDSCO inspections and DPDP compliance.
 */
const PhiAuditLog = model.define("phi_audit_log", {
  id: model.id().primaryKey(),
  user_id: model.text(),
  role: model.text(),
  action: model.enum(["read", "write", "update", "export", "print"]),
  entity_type: model.text(),
  entity_id: model.text(),
  ip_address: model.text(),
  user_agent: model.text(),
  access_granted: model.boolean().default(true),
})

export default PhiAuditLog
