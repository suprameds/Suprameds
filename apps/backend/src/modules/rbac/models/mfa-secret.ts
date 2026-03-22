import { model } from "@medusajs/framework/utils"

/**
 * MfaSecret — stores TOTP secrets for admin users who have MFA-required roles.
 * The secret is used to generate/verify 6-digit TOTP codes (RFC 6238).
 */
const MfaSecret = model.define("mfa_secret", {
  id: model.id().primaryKey(),
  user_id: model.text().unique(),
  secret: model.text(),
  is_verified: model.boolean().default(false),
  backup_codes: model.json().nullable(),
  last_verified_at: model.dateTime().nullable(),
})

export default MfaSecret
