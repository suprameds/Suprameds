import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { MedusaError, Modules } from "@medusajs/framework/utils"
import { RBAC_MODULE } from "../../../../modules/rbac"
import { createLogger } from "../../../../lib/logger"

const logger = createLogger("admin:auth:register")

/**
 * Roles that can be assigned immediately on self-registration
 * (no admin approval needed). All other roles are gated.
 */
const UNGATED_ROLES = new Set([
  "viewer",
  "guest",
  "customer",
  "support_agent",
  "catalog_manager",
  "content_moderator",
])

/**
 * POST /admin/auth/register — Self-registration for admin users.
 *
 * Flow:
 *  1. Validate input (email, password strength, role exists)
 *  2. Check email doesn't already exist
 *  3. Create auth identity via Medusa's auth module (emailpass provider)
 *  4. Create user via Medusa's user module
 *  5. Link auth identity to user
 *  6. Assign "viewer" role immediately
 *  7. If requested role is gated: create SignupRequest (pending)
 *  8. If requested role is ungated: assign it directly
 *
 * This route does NOT require authentication — it's for new users.
 */
export async function POST(req: MedusaRequest, res: MedusaResponse) {
  const { email, password, first_name, last_name, requested_role_code } =
    req.body as {
      email?: string
      password?: string
      first_name?: string
      last_name?: string
      requested_role_code?: string
    }

  // ── Validate required fields ──────────────────────────────────────────
  if (!email?.trim()) {
    throw new MedusaError(MedusaError.Types.INVALID_DATA, "email is required")
  }
  if (!password) {
    throw new MedusaError(
      MedusaError.Types.INVALID_DATA,
      "password is required"
    )
  }
  if (!first_name?.trim()) {
    throw new MedusaError(
      MedusaError.Types.INVALID_DATA,
      "first_name is required"
    )
  }
  if (!last_name?.trim()) {
    throw new MedusaError(
      MedusaError.Types.INVALID_DATA,
      "last_name is required"
    )
  }
  if (!requested_role_code?.trim()) {
    throw new MedusaError(
      MedusaError.Types.INVALID_DATA,
      "requested_role_code is required"
    )
  }

  // ── Password strength ────────────────────────────────────────────────
  const pwErrors: string[] = []
  if (password.length < 8) pwErrors.push("at least 8 characters")
  if (!/[A-Z]/.test(password)) pwErrors.push("one uppercase letter")
  if (!/[a-z]/.test(password)) pwErrors.push("one lowercase letter")
  if (!/\d/.test(password)) pwErrors.push("one digit")
  if (pwErrors.length > 0) {
    throw new MedusaError(
      MedusaError.Types.INVALID_DATA,
      `Password must contain ${pwErrors.join(", ")}.`
    )
  }

  const normalizedEmail = email.trim().toLowerCase()

  const rbacService = req.scope.resolve(RBAC_MODULE) as any
  const userModuleService = req.scope.resolve(Modules.USER) as any
  const authModuleService = req.scope.resolve(Modules.AUTH) as any

  // ── Validate role exists ─────────────────────────────────────────────
  const roles = (await rbacService.listRoles(
    { code: requested_role_code },
    { take: 1 }
  )) as any[]
  if (roles.length === 0) {
    throw new MedusaError(
      MedusaError.Types.NOT_FOUND,
      `Role "${requested_role_code}" does not exist. Contact your administrator.`
    )
  }

  // ── Check email not already registered ───────────────────────────────
  try {
    const existingUsers = await userModuleService.listUsers(
      { email: normalizedEmail },
      { take: 1 }
    )
    if (existingUsers.length > 0) {
      throw new MedusaError(
        MedusaError.Types.DUPLICATE_ERROR,
        "An account with this email already exists. Please sign in instead."
      )
    }
  } catch (err: any) {
    if (err instanceof MedusaError) throw err
    // If user module query fails, let it proceed — the auth step will catch dupes
  }

  try {
    // ── Create auth identity (emailpass provider) ─────────────────────
    // This registers the email+password with Medusa's auth system
    const authIdentity = await authModuleService.createAuthIdentities({
      provider_identities: [
        {
          provider: "emailpass",
          entity_id: normalizedEmail,
          provider_metadata: {
            password,
          },
        },
      ],
    })

    // ── Create user ──────────────────────────────────────────────────
    const user = await userModuleService.createUsers({
      email: normalizedEmail,
      first_name: first_name.trim(),
      last_name: last_name.trim(),
    })

    // ── Link auth identity → user ────────────────────────────────────
    await authModuleService.updateAuthIdentities({
      id: authIdentity.id,
      app_metadata: {
        user_id: user.id,
      },
    })

    // ── Assign viewer role immediately ───────────────────────────────
    try {
      await rbacService.assignRole(
        user.id,
        "viewer",
        "system:self-registration",
        "Auto-assigned on self-registration"
      )
    } catch (err: any) {
      logger.warn(
        `Could not assign viewer role to ${user.id}: ${err.message}`
      )
    }

    // ── Handle requested role ────────────────────────────────────────
    let pendingRole: string | null = null
    const isGated = !UNGATED_ROLES.has(requested_role_code)

    if (requested_role_code === "viewer") {
      // Already assigned above — nothing to do
    } else if (!isGated) {
      // Ungated role — assign directly
      try {
        await rbacService.assignRole(
          user.id,
          requested_role_code,
          "system:self-registration",
          "Ungated role — auto-assigned on self-registration"
        )
      } catch (err: any) {
        logger.warn(
          `Could not assign ungated role "${requested_role_code}" to ${user.id}: ${err.message}`
        )
        pendingRole = requested_role_code
      }
    } else {
      // Gated role — create SignupRequest for admin review
      pendingRole = requested_role_code

      await rbacService.createSignupRequests({
        email: normalizedEmail,
        first_name: first_name.trim(),
        last_name: last_name.trim(),
        requested_role_code,
        status: "pending",
        user_id: user.id,
      })

      // Emit event for admin notification
      try {
        const eventBus = req.scope.resolve(Modules.EVENT_BUS) as any
        await eventBus.emit("admin.signup_request.created", {
          data: {
            email: normalizedEmail,
            first_name: first_name.trim(),
            last_name: last_name.trim(),
            requested_role_code,
            user_id: user.id,
          },
        })
      } catch (err: any) {
        logger.warn(`Could not emit signup_request event: ${err.message}`)
      }
    }

    return res.status(201).json({
      success: true,
      user_id: user.id,
      role_assigned: "viewer",
      pending_role: pendingRole,
      message: pendingRole
        ? `Account created. You have viewer access. Your request for "${pendingRole}" is pending admin approval.`
        : `Account created with role "${requested_role_code === "viewer" ? "viewer" : requested_role_code}".`,
    })
  } catch (error: any) {
    if (error instanceof MedusaError) throw error

    // Handle auth identity duplicate
    if (
      error.message?.includes("already exists") ||
      error.message?.includes("duplicate")
    ) {
      throw new MedusaError(
        MedusaError.Types.DUPLICATE_ERROR,
        "An account with this email already exists. Please sign in instead."
      )
    }

    logger.error(`Registration failed for ${normalizedEmail}: ${error.message}`)
    return res.status(500).json({
      message: error.message || "Registration failed. Please try again.",
    })
  }
}
