import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"

const RBAC_MODULE = "rbac"

/**
 * GET /admin/mfa/setup
 * Returns MFA status for the current admin user.
 */
export const GET = async (req: AuthenticatedMedusaRequest, res: MedusaResponse) => {
  const userId = req.auth_context?.actor_id || req.auth_context?.auth_identity_id
  if (!userId) return res.status(401).json({ error: "Not authenticated" })

  const rbacService = req.scope.resolve(RBAC_MODULE) as any
  const requiresMfa = await rbacService.userRequiresMfa(userId)
  const hasMfaSetup = await rbacService.userHasMfaSetup(userId)

  return res.json({
    requires_mfa: requiresMfa,
    mfa_enabled: hasMfaSetup,
    user_id: userId,
  })
}

/**
 * POST /admin/mfa/setup
 * Generates a new TOTP secret for the current admin user.
 * Returns the secret and an otpauth:// URI for QR code generation.
 */
export const POST = async (req: AuthenticatedMedusaRequest, res: MedusaResponse) => {
  const userId = req.auth_context?.actor_id || req.auth_context?.auth_identity_id
  if (!userId) return res.status(401).json({ error: "Not authenticated" })

  const rbacService = req.scope.resolve(RBAC_MODULE) as any
  const { secret, is_new } = await rbacService.getOrCreateMfaSecret(userId)

  const email = (req as any).auth_context?.app_metadata?.email_address || userId
  const issuer = "Suprameds Admin"
  const uri = `otpauth://totp/${encodeURIComponent(issuer)}:${encodeURIComponent(email)}?secret=${secret}&issuer=${encodeURIComponent(issuer)}&algorithm=SHA1&digits=6&period=30`

  return res.json({
    secret,
    otpauth_uri: uri,
    is_new,
  })
}
