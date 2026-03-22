import type {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import { RBAC_MODULE } from "../../../../modules/rbac"

/**
 * GET /admin/rbac/audit-log?limit=50&offset=0
 * List recent role audit-log entries (newest first).
 */
export async function GET(
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) {
  const rbacService = req.scope.resolve(RBAC_MODULE) as any

  const { limit: rawLimit, offset: rawOffset } = req.query as Record<
    string,
    string
  >
  const limit = Math.min(parseInt(rawLimit || "50", 10) || 50, 200)
  const offset = parseInt(rawOffset || "0", 10) || 0

  try {
    const [entries, count] = await rbacService.listAndCountRoleAuditLogs(
      {},
      {
        take: limit,
        skip: offset,
        order: { created_at: "DESC" },
      }
    )

    // Pre-fetch all referenced roles to avoid N+1 per entry
    const uniqueRoleIds = [...new Set(entries.map((e: any) => e.role_id))]
    const roleMap = new Map<string, string>()

    for (const roleId of uniqueRoleIds) {
      try {
        const role = await rbacService.retrieveRole(roleId as string)
        roleMap.set(roleId as string, role.name)
      } catch {
        roleMap.set(roleId as string, "Unknown")
      }
    }

    const enrichedEntries = entries.map((entry: any) => ({
      id: entry.id,
      user_id: entry.user_id,
      role_id: entry.role_id,
      role_name: roleMap.get(entry.role_id) || "Unknown",
      action: entry.action,
      performed_by: entry.performed_by,
      reason: entry.reason,
      created_at: entry.created_at,
    }))

    return res.json({
      entries: enrichedEntries,
      count,
      limit,
      offset,
    })
  } catch (error: any) {
    return res.status(500).json({
      message: error.message || "Failed to list audit log",
    })
  }
}
