import type {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import { RBAC_MODULE } from "../../../../modules/rbac"

/**
 * POST /admin/rbac/seed — Seed default roles and permissions.
 *
 * Delegates to the canonical seedRolesAndPermissions() which creates all 25
 * roles with correct metadata.permissions arrays + ~65 permission records.
 * Idempotent: skips roles/permissions that already exist.
 */
export async function POST(
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) {
  const rbacService = req.scope.resolve(RBAC_MODULE) as any

  try {
    await rbacService.seedRolesAndPermissions()

    return res.status(201).json({
      success: true,
      message: "Roles and permissions seeded via canonical seed (25 roles, ~65 permissions with full metadata.permissions mappings)",
    })
  } catch (error: any) {
    return res.status(500).json({
      message: error.message || "Failed to seed roles and permissions",
    })
  }
}
