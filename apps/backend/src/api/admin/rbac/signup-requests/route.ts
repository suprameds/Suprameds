import type {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import { RBAC_MODULE } from "../../../../modules/rbac"

/**
 * GET /admin/rbac/signup-requests — List signup requests.
 * Query params:
 *   - status: "pending" | "approved" | "rejected" (default: all)
 *   - limit: number (default: 50)
 *   - offset: number (default: 0)
 */
export async function GET(
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) {
  const rbacService = req.scope.resolve(RBAC_MODULE) as any

  const { status, limit, offset } = req.query as {
    status?: string
    limit?: string
    offset?: string
  }

  try {
    const filters: Record<string, any> = {}
    if (status && ["pending", "approved", "rejected"].includes(status)) {
      filters.status = status
    }

    const take = Math.min(parseInt(limit || "50", 10) || 50, 200)
    const skip = parseInt(offset || "0", 10) || 0

    const [requests, count] = await rbacService.listAndCountSignupRequests(
      filters,
      {
        take,
        skip,
        order: { created_at: "DESC" },
      }
    )

    return res.json({
      signup_requests: (requests as any[]).map((r) => ({
        id: r.id,
        email: r.email,
        first_name: r.first_name,
        last_name: r.last_name,
        requested_role_code: r.requested_role_code,
        status: r.status,
        user_id: r.user_id,
        reviewed_by: r.reviewed_by,
        reviewed_at: r.reviewed_at,
        rejection_reason: r.rejection_reason,
        created_at: r.created_at,
        updated_at: r.updated_at,
      })),
      count,
      limit: take,
      offset: skip,
    })
  } catch (error: any) {
    return res.status(500).json({
      message: error.message || "Failed to list signup requests",
    })
  }
}
