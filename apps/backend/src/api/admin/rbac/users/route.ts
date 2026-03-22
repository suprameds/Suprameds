import type {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import { Modules } from "@medusajs/framework/utils"
import { RBAC_MODULE } from "../../../../modules/rbac"

/**
 * GET /admin/rbac/users?search=...&limit=20&offset=0
 * List users with their assigned roles.
 */
export async function GET(
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) {
  const userService = req.scope.resolve(Modules.USER) as any
  const rbacService = req.scope.resolve(RBAC_MODULE) as any

  const {
    search,
    role_code,
    limit: rawLimit,
    offset: rawOffset,
  } = req.query as Record<string, string>

  const limit = Math.min(parseInt(rawLimit || "20", 10) || 20, 100)
  const offset = parseInt(rawOffset || "0", 10) || 0

  try {
    // If filtering by role_code, find users with that specific role
    if (role_code) {
      const [targetRole] = (await rbacService.listRoles(
        { code: role_code },
        { take: 1 }
      )) as any[]

      if (!targetRole) {
        return res.json({ users: [], count: 0, limit, offset })
      }

      const activeAssignments = await rbacService.listUserRoles({
        role_id: targetRole.id,
        is_active: true,
      })

      const usersResult = await Promise.all(
        activeAssignments.map(async (assignment: any) => {
          let email: string | null = null
          try {
            const user = await userService.retrieveUser(assignment.user_id)
            email = user.email ?? null
          } catch {
            // User may have been deleted
          }
          return {
            user_id: assignment.user_id,
            email,
            roles: [
              {
                role_code: targetRole.code,
                assigned_at: assignment.created_at,
              },
            ],
          }
        })
      )

      return res.json({ users: usersResult, count: usersResult.length, limit, offset })
    }

    // General user search
    const filters: Record<string, any> = {}
    if (search) {
      filters.$or = [
        { id: { $like: `%${search}%` } },
        { email: { $like: `%${search}%` } },
      ]
    }

    const [users, count] = await userService.listAndCountUsers(filters, {
      take: limit,
      skip: offset,
      order: { email: "ASC" },
    })

    // Attach active roles for each user in the shape the UI expects
    const usersWithRoles = await Promise.all(
      users.map(async (user: any) => {
        const activeAssignments = await rbacService.listUserRoles({
          user_id: user.id,
          is_active: true,
        })

        const roles: { role_code: string; assigned_at: string }[] = []
        for (const assignment of activeAssignments) {
          try {
            const role = await rbacService.retrieveRole(assignment.role_id)
            roles.push({
              role_code: role.code,
              assigned_at: assignment.created_at,
            })
          } catch {
            // Role may have been deleted
          }
        }

        return {
          user_id: user.id,
          email: user.email ?? null,
          first_name: user.first_name,
          last_name: user.last_name,
          roles,
        }
      })
    )

    return res.json({
      users: usersWithRoles,
      count,
      limit,
      offset,
    })
  } catch (error: any) {
    return res.status(500).json({
      message: error.message || "Failed to list users with roles",
    })
  }
}
