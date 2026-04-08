import {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import { COMPLIANCE_MODULE } from "../../../modules/compliance"

/**
 * GET /store/documents
 *
 * Lists the authenticated customer's uploaded verification documents
 * with their current review status.
 */
export const GET = async (
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) => {
  const customerId = (req as any).auth_context?.actor_id
  if (!customerId) {
    return res.status(401).json({ error: "Authentication required" })
  }

  const complianceService = req.scope.resolve(COMPLIANCE_MODULE) as any

  try {
    const documents = await complianceService.listCustomerDocuments(
      { customer_id: customerId },
      {
        order: { created_at: "DESC" },
      }
    )

    return res.json({ documents })
  } catch (err: any) {
    const logger = req.scope.resolve("logger") as any
    logger.error(`[documents] List failed: ${err.message}`)
    return res.status(500).json({ error: "Failed to retrieve documents" })
  }
}
