import type {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import { MedusaError } from "@medusajs/framework/utils"
import { RBAC_MODULE } from "../../../../modules/rbac"

/**
 * Static Separation of Duty pairs (SSD-08).
 * Users cannot simultaneously hold both roles in any pair.
 */
const SSD_PAIRS: [string, string][] = [
  ["pharmacist", "warehouse_manager"],
  ["finance", "warehouse_manager"],
]

/** Maximum number of users that can hold the super_admin role */
const MAX_SUPER_ADMINS = 3

/**
 * POST /admin/rbac/assign — Assign a role to a user.
 * Body: { user_id: string, role_code: string, reason?: string }
 */
export async function POST(
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) {
  const rbacService = req.scope.resolve(RBAC_MODULE) as any
  const adminUserId = req.auth_context?.actor_id

  const { user_id, role_code, reason } = req.body as {
    user_id?: string
    role_code?: string
    reason?: string
  }

  // ── Validate required fields ──
  if (!user_id) {
    throw new MedusaError(MedusaError.Types.INVALID_DATA, "user_id is required")
  }
  if (!role_code) {
    throw new MedusaError(MedusaError.Types.INVALID_DATA, "role_code is required")
  }

  try {
    // Resolve the target role by code
    const [roles] = await rbacService.listAndCountRoles({ code: role_code })
    if (!roles.length) {
      throw new MedusaError(
        MedusaError.Types.NOT_FOUND,
        `Role with code "${role_code}" not found`
      )
    }
    const targetRole = roles[0]

    // ── Check for duplicate active assignment ──
    const existingAssignments = await rbacService.listUserRoles({
      user_id,
      role_id: targetRole.id,
      is_active: true,
    })
    if (existingAssignments.length > 0) {
      throw new MedusaError(
        MedusaError.Types.DUPLICATE_ERROR,
        `User already has the "${role_code}" role`
      )
    }

    // ── SSD-08: Static Separation of Duty validation ──
    const currentAssignments = await rbacService.listUserRoles({
      user_id,
      is_active: true,
    })
    const currentRoleIds = currentAssignments.map((a: any) => a.role_id)

    // Resolve current role codes for SSD check
    const currentRoleCodes: string[] = []
    for (const roleId of currentRoleIds) {
      try {
        const role = await rbacService.retrieveRole(roleId)
        currentRoleCodes.push(role.code)
      } catch {
        // Skip deleted roles
      }
    }

    for (const [roleA, roleB] of SSD_PAIRS) {
      const conflicting =
        (role_code === roleA && currentRoleCodes.includes(roleB)) ||
        (role_code === roleB && currentRoleCodes.includes(roleA))

      if (conflicting) {
        const existingConflict = role_code === roleA ? roleB : roleA
        throw new MedusaError(
          MedusaError.Types.NOT_ALLOWED,
          `SSD violation: "${role_code}" conflicts with existing role "${existingConflict}". ` +
            `These roles cannot be held simultaneously.`
        )
      }
    }

    // ── Super-admin cap ──
    if (role_code === "super_admin") {
      const [, superAdminCount] = await rbacService.listAndCountUserRoles({
        role_id: targetRole.id,
        is_active: true,
      })
      if (superAdminCount >= MAX_SUPER_ADMINS) {
        throw new MedusaError(
          MedusaError.Types.NOT_ALLOWED,
          `Cannot exceed ${MAX_SUPER_ADMINS} super_admin users`
        )
      }
    }

    // ── Create the assignment ──
    await rbacService.createUserRoles({
      user_id,
      role_id: targetRole.id,
      assigned_by: adminUserId || "system",
      reason: reason || null,
      is_active: true,
    })

    // ── Audit log ──
    await rbacService.createRoleAuditLogs({
      user_id,
      role_id: targetRole.id,
      action: "assign",
      performed_by: adminUserId || "system",
      reason: reason || null,
    })

    return res.status(201).json({
      success: true,
      message: `Role "${role_code}" assigned to user ${user_id}`,
    })
  } catch (error: any) {
    if (error instanceof MedusaError) {
      throw error
    }
    return res.status(500).json({
      message: error.message || "Failed to assign role",
    })
  }
}
