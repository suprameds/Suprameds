import type {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import { MedusaError } from "@medusajs/framework/utils"
import { RBAC_MODULE } from "../../../../modules/rbac"

/**
 * POST /admin/rbac/revoke — Revoke a role from a user.
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

    // Find the active assignment
    const activeAssignments = await rbacService.listUserRoles({
      user_id,
      role_id: targetRole.id,
      is_active: true,
    })
    if (!activeAssignments.length) {
      throw new MedusaError(
        MedusaError.Types.NOT_FOUND,
        `User does not have an active "${role_code}" role`
      )
    }

    // Deactivate all matching assignments (should be exactly one)
    for (const assignment of activeAssignments) {
      await rbacService.updateUserRoles(assignment.id, { is_active: false })
    }

    // ── Audit log ──
    await rbacService.createRoleAuditLogs({
      user_id,
      role_id: targetRole.id,
      action: "revoke",
      performed_by: adminUserId || "system",
      reason: reason || null,
    })

    return res.json({
      success: true,
      message: `Role "${role_code}" revoked from user ${user_id}`,
    })
  } catch (error: any) {
    if (error instanceof MedusaError) {
      throw error
    }
    return res.status(500).json({
      message: error.message || "Failed to revoke role",
    })
  }
}
