import {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import { COMPLIANCE_MODULE } from "../../../modules/compliance"

/**
 * GET /admin/documents
 *
 * Lists customer documents for the admin review queue.
 * Query params:
 *   - status: "pending" | "approved" | "rejected" (optional filter)
 *   - customer_id: filter by customer (optional)
 *   - limit: number of results (default 50)
 *   - offset: pagination offset (default 0)
 */
export const GET = async (
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) => {
  const complianceService = req.scope.resolve(COMPLIANCE_MODULE) as any

  const { status, customer_id, limit, offset } = req.query as {
    status?: string
    customer_id?: string
    limit?: string
    offset?: string
  }

  const filters: Record<string, unknown> = {}
  if (status) filters.status = status
  if (customer_id) filters.customer_id = customer_id

  try {
    const take = Math.min(Number(limit) || 50, 200)
    const skip = Number(offset) || 0

    const [documents, count] = await Promise.all([
      complianceService.listCustomerDocuments(filters, {
        take,
        skip,
        order: { created_at: "DESC" },
      }),
      complianceService.listCustomerDocuments(filters, {
        take: null,
      }),
    ])

    return res.json({
      documents,
      count: (count as any[]).length,
      limit: take,
      offset: skip,
    })
  } catch (err: any) {
    const logger = req.scope.resolve("logger") as any
    logger.error(`[admin/documents] List failed: ${err.message}`)
    return res.status(500).json({ error: "Failed to retrieve documents" })
  }
}
