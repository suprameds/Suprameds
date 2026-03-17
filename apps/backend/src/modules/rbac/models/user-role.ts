import { model } from "@medusajs/framework/utils"

/**
 * UserRole — assignment of roles to users with audit trail.
 */
const UserRole = model.define("user_role", {
  id: model.id().primaryKey(),
  user_id: model.text(),
  role_id: model.text(),
  assigned_by: model.text(),
  reason: model.text().nullable(),
  is_active: model.boolean().default(true),
})

export default UserRole
