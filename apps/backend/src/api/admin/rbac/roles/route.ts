import type {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import { RBAC_MODULE } from "../../../../modules/rbac"

/**
 * GET /admin/rbac/roles — List all roles with user counts.
 */
export async function GET(
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) {
  const rbacService = req.scope.resolve(RBAC_MODULE) as any

  try {
    const roles = await rbacService.listRoles(
      {},
      { take: null, order: { name: "ASC" } }
    )

    // Count active user assignments per role
    const rolesWithCounts = await Promise.all(
      roles.map(async (role: any) => {
        const [, count] = await rbacService.listAndCountUserRoles({
          role_id: role.id,
          is_active: true,
        })

        const meta = role.metadata ?? {}
        const permissions = (meta.permissions ?? []) as string[]
        const tier = (meta.tier ?? 5) as number

        return {
          id: role.id,
          name: role.name,
          code: role.code,
          description: role.description,
          clinical: !!role.is_clinical,
          mfa_required: !!role.requires_mfa,
          is_active: role.is_active,
          tier,
          permissions,
          active_users_count: count ?? 0,
        }
      })
    )

    return res.json({ roles: rolesWithCounts })
  } catch (error: any) {
    return res.status(500).json({
      message: error.message || "Failed to list roles",
    })
  }
}
