import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { MedusaError } from "@medusajs/framework/utils"
import { getRefundRaiser } from "../../../../rbac-ssd-helpers"
import { ApproveRefundWorkflow } from "../../../../../workflows/payment/approve-refund"

/**
 * POST /admin/refunds/:id/approve
 * Finance admin approves a pending refund.
 * SSD-04: the approver must differ from the user who raised the refund.
 */
export async function POST(req: MedusaRequest, res: MedusaResponse) {
  const { id } = req.params
  const actorId = (req as any).auth_context?.actor_id

  if (!actorId) {
    throw new MedusaError(MedusaError.Types.UNAUTHORIZED, "Authentication required")
  }

  // SSD-04 pre-check: resolve raiser and compare with approver
  const raisedBy = await getRefundRaiser(req)
  if (raisedBy && raisedBy === actorId) {
    throw new MedusaError(
      MedusaError.Types.NOT_ALLOWED,
      "SSD-04 violation: you cannot approve a refund that you raised. A different finance_admin must approve."
    )
  }

  const { result, errors } = await ApproveRefundWorkflow(req.scope).run({
    input: {
      refund_id: id,
      approved_by: actorId,
    },
  })

  if (errors && errors.length > 0) {
    throw new MedusaError(
      MedusaError.Types.INVALID_DATA,
      errors[0].error?.message || "Approve refund workflow failed"
    )
  }

  return res.json({ refund: result })
}
