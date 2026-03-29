import type { MedusaNextFunction, MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { createHmac } from "crypto"
import { RBAC_MODULE } from "../../../modules/rbac"
import { createLogger } from "../../../lib/logger"

const logger = createLogger("admin:middleware:mfa-guard")

const MFA_COOKIE_NAME = "smeds_mfa"
const MFA_MAX_AGE_MS = 8 * 60 * 60 * 1000 // 8 hours

/**
 * Parse a specific cookie value from the raw Cookie header.
 * Avoids requiring the cookie-parser dependency.
 */
function getCookie(req: MedusaRequest, name: string): string | undefined {
  // Use parsed cookies if available (e.g. cookie-parser is loaded)
  const parsed = (req as any).cookies
  if (parsed && typeof parsed === "object" && parsed[name]) {
    return parsed[name]
  }

  const header = req.headers.cookie
  if (!header) return undefined

  const prefix = `${name}=`
  const cookies = header.split(";")
  for (const cookie of cookies) {
    const trimmed = cookie.trim()
    if (trimmed.startsWith(prefix)) {
      return decodeURIComponent(trimmed.slice(prefix.length))
    }
  }
  return undefined
}

/**
 * Middleware that enforces MFA verification for admin users whose roles require it.
 *
 * - Skips for /admin/mfa/* routes (setup + verify must remain accessible)
 * - Skips if the user's roles don't require MFA
 * - Validates the signed MFA cookie (userId, timestamp, HMAC signature)
 * - Fails open on unexpected errors to avoid locking admins out entirely
 */
export function requireMfa() {
  return async (req: MedusaRequest, res: MedusaResponse, next: MedusaNextFunction) => {
    if (req.path.startsWith("/admin/mfa")) {
      return next()
    }

    const userId =
      (req as any).auth_context?.actor_id ||
      (req as any).auth_context?.auth_identity_id
    if (!userId) {
      return next()
    }

    try {
      const rbacService = req.scope.resolve(RBAC_MODULE) as any
      const requiresMfa: boolean = await rbacService.userRequiresMfa(userId)

      if (!requiresMfa) {
        return next()
      }

      // Only enforce MFA if the user has actually completed setup.
      // Without this, newly-assigned roles would be locked out immediately.
      const hasMfaSetup: boolean = await rbacService.userHasMfaSetup(userId)
      if (!hasMfaSetup) {
        return next()
      }

      const cookieValue = getCookie(req, MFA_COOKIE_NAME)
      if (!cookieValue) {
        return res.status(403).json({
          error: "MFA verification required",
          mfa_required: true,
          message: "Your role requires multi-factor authentication. Please verify your identity.",
        })
      }

      // Cookie format: userId:timestamp:hmacSignature
      const parts = cookieValue.split(":")
      if (parts.length !== 3) {
        return res.status(403).json({ error: "MFA verification required", mfa_required: true })
      }

      const [cookieUserId, timestamp, signature] = parts
      const cookieSecret = process.env.COOKIE_SECRET
      if (!cookieSecret) {
        logger.error("COOKIE_SECRET not set — MFA cookie verification impossible")
        return res.status(403).json({ error: "MFA verification required", mfa_required: true })
      }
      const expectedSig = createHmac("sha256", cookieSecret)
        .update(`${cookieUserId}:${timestamp}`)
        .digest("hex")

      if (signature !== expectedSig || cookieUserId !== userId) {
        return res.status(403).json({ error: "MFA verification required", mfa_required: true })
      }

      const age = Date.now() - parseInt(timestamp, 10)
      if (age > MFA_MAX_AGE_MS) {
        return res.status(403).json({
          error: "MFA session expired",
          mfa_required: true,
          message: "Your MFA session has expired. Please verify again.",
        })
      }

      return next()
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)

      // Table-not-found means RBAC module migrations haven't run yet.
      // Log once-style warning instead of a full stack trace on every request.
      if (msg.includes("does not exist") || msg.includes("TableNotFoundException")) {
        if (!(requireMfa as any).__warnedMissingTable) {
          logger.warn(
            "RBAC tables not yet migrated (mfa_secret missing). " +
              "MFA enforcement is disabled until 'medusa db:migrate' is run."
          )
          ;(requireMfa as any).__warnedMissingTable = true
        }
      } else {
        logger.error("Unexpected error:", msg)
      }

      return next() // Fail open to avoid completely locking out admins
    }
  }
}
