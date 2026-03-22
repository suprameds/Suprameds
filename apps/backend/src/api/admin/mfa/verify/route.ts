import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { createHmac } from "crypto"

const RBAC_MODULE = "rbac"
const MFA_COOKIE_NAME = "smeds_mfa"
const MFA_COOKIE_MAX_AGE_S = 8 * 60 * 60 // 8 hours

/**
 * POST /admin/mfa/verify
 * Verifies a 6-digit TOTP code and sets a signed MFA session cookie.
 * Body: { code: "123456" }
 */
export const POST = async (req: AuthenticatedMedusaRequest, res: MedusaResponse) => {
  const userId = req.auth_context?.actor_id || req.auth_context?.auth_identity_id
  if (!userId) return res.status(401).json({ error: "Not authenticated" })

  const { code } = req.body as { code?: string }
  if (!code || code.length !== 6) {
    return res.status(400).json({ error: "A 6-digit code is required" })
  }

  const rbacService = req.scope.resolve(RBAC_MODULE) as any
  const isValid = await rbacService.verifyMfaCode(userId, code)

  if (!isValid) {
    return res.status(401).json({ error: "Invalid verification code. Please try again." })
  }

  // Build a signed cookie: userId:timestamp:hmac
  const cookieSecret = process.env.COOKIE_SECRET || "default-secret"
  const payload = `${userId}:${Date.now()}`
  const signature = createHmac("sha256", cookieSecret).update(payload).digest("hex")
  const cookieValue = `${payload}:${signature}`

  res.cookie(MFA_COOKIE_NAME, cookieValue, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: MFA_COOKIE_MAX_AGE_S * 1000,
    path: "/",
  })

  return res.json({ verified: true })
}
