import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { MedusaError } from "@medusajs/framework/utils"
import { ProcessRefundWorkflow } from "../../../../../workflows/payment/process-refund"

/**
 * POST /admin/refunds/:id/process
 * Triggers gateway refund processing for an approved refund.
 * For Razorpay: initiates the refund via Razorpay API.
 * For COD: requires bank details to have been submitted first.
 */
export async function POST(req: MedusaRequest, res: MedusaResponse) {
  const { id } = req.params
  const actorId = (req as any).auth_context?.actor_id

  if (!actorId) {
    throw new MedusaError(MedusaError.Types.UNAUTHORIZED, "Authentication required")
  }

  const { result, errors } = await ProcessRefundWorkflow(req.scope).run({
    input: {
      refund_id: id,
    },
  })

  if (errors && errors.length > 0) {
    throw new MedusaError(
      MedusaError.Types.INVALID_DATA,
      errors[0].error?.message || "Process refund workflow failed"
    )
  }

  return res.json({ refund: result })
}
