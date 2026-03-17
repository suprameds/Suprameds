import { model } from "@medusajs/framework/utils"

/**
 * Role — system roles with clinical/MFA requirements.
 */
const Role = model.define("role", {
  id: model.id().primaryKey(),
  name: model.text(),
  code: model.text().unique(),
  description: model.text().nullable(),
  is_clinical: model.boolean().default(false),
  requires_mfa: model.boolean().default(false),
  is_active: model.boolean().default(true),
  metadata: model.json().nullable(),
})

export default Role
