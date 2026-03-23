import type {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import { MedusaError, Modules } from "@medusajs/framework/utils"
import { RBAC_MODULE } from "../../../../modules/rbac"

const LOG = "[rbac-invite]"

/**
 * POST /admin/rbac/invite — Create an admin invite with an intended RBAC role.
 * Body: { email: string, role_code: string }
 *
 * 1. Validates the role exists
 * 2. Creates a Medusa invite via the User module
 * 3. Stores the email→role mapping in InviteRole
 * 4. Directly sends the invite email (doesn't rely solely on event bus)
 *
 * When the user accepts the invite, the `user.created` subscriber
 * calls rbacService.assignDefaultRole() which consumes this mapping.
 */
export async function POST(
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) {
  const rbacService = req.scope.resolve(RBAC_MODULE) as any
  const adminUserId = req.auth_context?.actor_id ?? "system"

  const { email, role_code } = req.body as {
    email?: string
    role_code?: string
  }

  if (!email?.trim()) {
    throw new MedusaError(MedusaError.Types.INVALID_DATA, "email is required")
  }
  if (!role_code?.trim()) {
    throw new MedusaError(MedusaError.Types.INVALID_DATA, "role_code is required")
  }

  const normalizedEmail = email.trim().toLowerCase()

  // Validate role exists
  const roles = (await rbacService.listRoles(
    { code: role_code },
    { take: 1 }
  )) as any[]
  if (roles.length === 0) {
    throw new MedusaError(
      MedusaError.Types.NOT_FOUND,
      `Role "${role_code}" does not exist. Run POST /admin/rbac/seed first.`
    )
  }

  try {
    // Create Medusa invite
    const userModuleService = req.scope.resolve(Modules.USER) as any
    const invite = await userModuleService.createInvites({
      email: normalizedEmail,
    })

    // Store the intended role mapping
    await rbacService.storeInviteRole(normalizedEmail, role_code, adminUserId)

    // Directly send invite email as a reliable fallback
    // (the event subscriber may also fire — Resend handles dedup)
    await sendInviteEmailDirect(req, invite, normalizedEmail)

    return res.status(201).json({
      success: true,
      message: `Invite sent to ${normalizedEmail} with role "${role_code}"`,
      invite_id: invite.id,
      role: roles[0].name,
    })
  } catch (error: any) {
    // Handle duplicate invite
    if (error.message?.includes("already") || error.type === "duplicate_error") {
      // Still store/update the role mapping even if invite already exists
      await rbacService.storeInviteRole(normalizedEmail, role_code, adminUserId)

      return res.status(200).json({
        success: true,
        message: `Invite already exists for ${normalizedEmail}. Role updated to "${role_code}".`,
        role: roles[0].name,
      })
    }

    if (error instanceof MedusaError) throw error
    return res.status(500).json({
      message: error.message || "Failed to create invite",
    })
  }
}

/**
 * Send the invite email directly via the notification module.
 * Non-throwing — logs errors but doesn't block the invite creation.
 */
async function sendInviteEmailDirect(
  req: AuthenticatedMedusaRequest,
  invite: { id: string; token?: string; email?: string },
  email: string
) {
  try {
    const notificationModuleService = req.scope.resolve("notification") as any

    let backendUrl: string
    let adminPath: string
    try {
      const config = req.scope.resolve("configModule") as any
      backendUrl =
        config?.admin?.backendUrl && config.admin.backendUrl !== "/"
          ? config.admin.backendUrl
          : process.env.BACKEND_URL ||
            process.env.MEDUSA_BACKEND_URL ||
            "http://localhost:9000"
      adminPath = config?.admin?.path || "/app"
    } catch {
      backendUrl =
        process.env.BACKEND_URL ||
        process.env.MEDUSA_BACKEND_URL ||
        "http://localhost:9000"
      adminPath = process.env.MEDUSA_ADMIN_PATH || "/app"
    }

    // If we have the token from the just-created invite, use it
    const inviteUrl = invite.token
      ? `${backendUrl}${adminPath}/invite?token=${invite.token}`
      : `${backendUrl}${adminPath}`

    await notificationModuleService.createNotifications({
      to: email,
      channel: "email",
      template: "user-invited",
      data: {
        invite_url: inviteUrl,
        email,
      },
    })

    console.info(`${LOG} Invite email sent directly to ${email}`)
  } catch (err) {
    console.error(
      `${LOG} Direct email send failed for ${email}:`,
      err instanceof Error ? err.message : err
    )
  }
}

/**
 * GET /admin/rbac/invite — List all pending invite-role mappings.
 */
export async function GET(
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) {
  const rbacService = req.scope.resolve(RBAC_MODULE) as any

  try {
    const inviteRoles = (await rbacService.listInviteRoles(
      {},
      { take: 100, order: { created_at: "DESC" } }
    )) as any[]

    return res.json({
      invite_roles: inviteRoles.map((ir: any) => ({
        id: ir.id,
        email: ir.email,
        role_code: ir.role_code,
        invited_by: ir.invited_by,
        created_at: ir.created_at,
      })),
    })
  } catch (error: any) {
    return res.status(500).json({
      message: error.message || "Failed to list invite roles",
    })
  }
}
