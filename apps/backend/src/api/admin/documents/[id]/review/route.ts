import {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import { COMPLIANCE_MODULE } from "../../../../../modules/compliance"

/**
 * POST /admin/documents/:id/review
 *
 * Approve or reject a customer verification document.
 *
 * Body: { action: "approve" | "reject", rejection_reason?: string }
 */
export const POST = async (
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) => {
  const { id } = req.params
  const userId = (req as any).auth_context?.actor_id
  const { action, rejection_reason } = req.body as {
    action: "approve" | "reject"
    rejection_reason?: string
  }

  if (!action || !["approve", "reject"].includes(action)) {
    return res.status(400).json({
      error: 'action is required and must be "approve" or "reject"',
    })
  }

  if (action === "reject" && !rejection_reason) {
    return res
      .status(400)
      .json({ error: "rejection_reason is required when rejecting a document" })
  }

  const complianceService = req.scope.resolve(COMPLIANCE_MODULE) as any

  try {
    // Verify the document exists
    const existing = await complianceService.retrieveCustomerDocument(id)
    if (!existing) {
      return res.status(404).json({ error: "Document not found" })
    }

    if (existing.status !== "pending") {
      return res.status(400).json({
        error: `Document has already been ${existing.status}. Only pending documents can be reviewed.`,
      })
    }

    const updateData: Record<string, unknown> = {
      id,
      status: action === "approve" ? "approved" : "rejected",
      reviewed_by: userId || null,
      reviewed_at: new Date(),
    }

    if (action === "reject") {
      updateData.rejection_reason = rejection_reason
    }

    const document = await complianceService.updateCustomerDocuments(updateData)

    return res.json({ document })
  } catch (err: any) {
    const logger = req.scope.resolve("logger") as any
    logger.error(`[admin/documents/${id}/review] Review failed: ${err.message}`)

    if (err.message?.includes("not found")) {
      return res.status(404).json({ error: "Document not found" })
    }

    return res.status(500).json({ error: "Failed to review document" })
  }
}
