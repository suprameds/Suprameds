import type {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import { Modules } from "@medusajs/framework/utils"
import { RBAC_MODULE } from "../../../../modules/rbac"

/**
 * GET /admin/rbac/me — Returns the currently logged-in admin user's
 * profile info, assigned roles, and aggregated permissions.
 */
export async function GET(
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) {
  const rbacService = req.scope.resolve(RBAC_MODULE) as any
  const userService = req.scope.resolve(Modules.USER) as any
  const actorId = req.auth_context?.actor_id

  if (!actorId) {
    return res.status(401).json({ message: "Not authenticated" })
  }

  try {
    // Fetch user profile
    let email: string | null = null
    let firstName: string | null = null
    let lastName: string | null = null
    try {
      const user = await userService.retrieveUser(actorId)
      email = user.email ?? null
      firstName = user.first_name ?? null
      lastName = user.last_name ?? null
    } catch {
      // User record might not exist yet
    }

    // Fetch all active role assignments
    const activeAssignments = await rbacService.listUserRoles({
      user_id: actorId,
      is_active: true,
    })

    const roles: {
      code: string
      name: string
      tier: number
      clinical: boolean
      mfa_required: boolean
      assigned_at: string
      permissions: string[]
    }[] = []

    const allPermissions = new Set<string>()

    for (const assignment of activeAssignments) {
      try {
        const role = await rbacService.retrieveRole(assignment.role_id)
        const meta = role.metadata ?? {}
        const permissions = (meta.permissions ?? []) as string[]
        const tier = (meta.tier ?? 5) as number

        permissions.forEach((p: string) => allPermissions.add(p))

        roles.push({
          code: role.code,
          name: role.name,
          tier,
          clinical: !!role.is_clinical,
          mfa_required: !!role.requires_mfa,
          assigned_at: assignment.created_at,
          permissions,
        })
      } catch {
        // Role may have been deleted
      }
    }

    // Fetch staff credentials
    const staffCredentials = await rbacService.listStaffCredentials(
      { user_id: actorId },
      { take: 10 }
    )

    return res.json({
      user_id: actorId,
      email,
      first_name: firstName,
      last_name: lastName,
      roles,
      permissions: Array.from(allPermissions).sort(),
      credentials: (staffCredentials as any[]).map((c: any) => ({
        id: c.id,
        credential_type: c.credential_type,
        credential_value: c.credential_value,
        holder_name: c.holder_name,
        issuing_authority: c.issuing_authority,
        is_verified: c.is_verified,
      })),
    })
  } catch (error: any) {
    return res.status(500).json({
      message: error.message || "Failed to fetch current user roles",
    })
  }
}
