import { model } from "@medusajs/framework/utils"

/**
 * RoleAuditLog — immutable log of role assignments/revocations.
 */
const RoleAuditLog = model.define("role_audit_log", {
  id: model.id().primaryKey(),
  user_id: model.text(),
  role_id: model.text(),
  action: model.enum(["assign", "revoke"]),
  performed_by: model.text(),
  reason: model.text().nullable(),
})

export default RoleAuditLog
