import type {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import { MedusaError, Modules } from "@medusajs/framework/utils"
import { RBAC_MODULE } from "../../../../modules/rbac"

/**
 * GET /admin/rbac/credentials?user_id=...&credential_type=...
 * List staff credentials, optionally filtered.
 */
export async function GET(
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) {
  const rbacService = req.scope.resolve(RBAC_MODULE) as any
  const userService = req.scope.resolve(Modules.USER) as any

  const { user_id, credential_type } = req.query as Record<string, string>

  try {
    const filters: Record<string, any> = {}
    if (user_id) filters.user_id = user_id
    if (credential_type) filters.credential_type = credential_type

    const credentials = await rbacService.listStaffCredentials(
      filters,
      { take: 100, order: { created_at: "DESC" } }
    )

    // Enrich with user email for display
    const enriched = await Promise.all(
      (credentials as any[]).map(async (cred) => {
        let email: string | null = null
        try {
          const user = await userService.retrieveUser(cred.user_id)
          email = user.email ?? null
        } catch {
          // User may have been deleted
        }
        return { ...cred, user_email: email }
      })
    )

    return res.json({ credentials: enriched })
  } catch (error: any) {
    return res.status(500).json({
      message: error.message || "Failed to list credentials",
    })
  }
}

/**
 * POST /admin/rbac/credentials
 * Create a new staff credential.
 * Body: { user_id, credential_type, credential_value, holder_name, issuing_authority?, valid_from?, valid_until? }
 */
export async function POST(
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) {
  const rbacService = req.scope.resolve(RBAC_MODULE) as any
  const adminUserId = req.auth_context?.actor_id

  const {
    user_id,
    credential_type,
    credential_value,
    holder_name,
    issuing_authority,
    valid_from,
    valid_until,
  } = req.body as any

  if (!user_id) {
    throw new MedusaError(MedusaError.Types.INVALID_DATA, "user_id is required")
  }
  if (!credential_type) {
    throw new MedusaError(MedusaError.Types.INVALID_DATA, "credential_type is required")
  }
  if (!credential_value) {
    throw new MedusaError(MedusaError.Types.INVALID_DATA, "credential_value is required")
  }
  if (!holder_name) {
    throw new MedusaError(MedusaError.Types.INVALID_DATA, "holder_name is required")
  }

  try {
    // Prevent duplicate active credentials of the same type for a user
    const existing = await rbacService.listStaffCredentials(
      { user_id, credential_type },
      { take: 1 }
    )
    if ((existing as any[]).length > 0) {
      throw new MedusaError(
        MedusaError.Types.DUPLICATE_ERROR,
        `User already has a ${credential_type} credential. Update or delete the existing one first.`
      )
    }

    const credential = await rbacService.createStaffCredentials({
      user_id,
      credential_type,
      credential_value: credential_value.trim(),
      holder_name: holder_name.trim(),
      issuing_authority: issuing_authority?.trim() || null,
      valid_from: valid_from ? new Date(valid_from) : null,
      valid_until: valid_until ? new Date(valid_until) : null,
      is_verified: false,
      verified_by: null,
      verified_at: null,
    })

    // Audit trail
    await rbacService.createRoleAuditLogs({
      user_id,
      role_id: "credential",
      action: "assign",
      performed_by: adminUserId || "system",
      reason: `Added ${credential_type}: ${credential_value}`,
    })

    return res.status(201).json({ credential })
  } catch (error: any) {
    if (error instanceof MedusaError) throw error
    return res.status(500).json({
      message: error.message || "Failed to create credential",
    })
  }
}
