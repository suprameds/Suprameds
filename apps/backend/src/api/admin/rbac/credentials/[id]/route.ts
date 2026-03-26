import type {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import { MedusaError } from "@medusajs/framework/utils"
import { RBAC_MODULE } from "../../../../../modules/rbac"

/**
 * POST /admin/rbac/credentials/:id — Update a staff credential.
 * Body: Partial<{ credential_value, holder_name, issuing_authority, valid_from, valid_until, is_verified }>
 */
export async function POST(
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) {
  const rbacService = req.scope.resolve(RBAC_MODULE) as any
  const adminUserId = req.auth_context?.actor_id
  const { id } = req.params

  const {
    credential_value,
    holder_name,
    issuing_authority,
    valid_from,
    valid_until,
    is_verified,
  } = req.body as any

  try {
    const updates: Record<string, any> = {}
    if (credential_value !== undefined) updates.credential_value = credential_value.trim()
    if (holder_name !== undefined) updates.holder_name = holder_name.trim()
    if (issuing_authority !== undefined) updates.issuing_authority = issuing_authority?.trim() || null
    if (valid_from !== undefined) updates.valid_from = valid_from ? new Date(valid_from) : null
    if (valid_until !== undefined) updates.valid_until = valid_until ? new Date(valid_until) : null

    if (is_verified !== undefined) {
      updates.is_verified = is_verified
      if (is_verified) {
        updates.verified_by = adminUserId || "system"
        updates.verified_at = new Date()
      } else {
        updates.verified_by = null
        updates.verified_at = null
      }
    }

    const credential = await rbacService.updateStaffCredentials(id, updates)

    return res.json({ credential })
  } catch (error: any) {
    if (error instanceof MedusaError) throw error
    return res.status(500).json({
      message: error.message || "Failed to update credential",
    })
  }
}

/**
 * DELETE /admin/rbac/credentials/:id — Delete a staff credential.
 */
export async function DELETE(
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) {
  const rbacService = req.scope.resolve(RBAC_MODULE) as any
  const adminUserId = req.auth_context?.actor_id
  const { id } = req.params

  try {
    // Fetch before deleting for audit
    const [cred] = (await rbacService.listStaffCredentials({ id }, { take: 1 })) as any[]
    if (!cred) {
      throw new MedusaError(MedusaError.Types.NOT_FOUND, `Credential ${id} not found`)
    }

    await rbacService.deleteStaffCredentials(id)

    await rbacService.createRoleAuditLogs({
      user_id: cred.user_id,
      role_id: "credential",
      action: "revoke",
      performed_by: adminUserId || "system",
      reason: `Removed ${cred.credential_type}: ${cred.credential_value}`,
    })

    return res.json({ success: true, id })
  } catch (error: any) {
    if (error instanceof MedusaError) throw error
    return res.status(500).json({
      message: error.message || "Failed to delete credential",
    })
  }
}
