import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { MedusaError } from "@medusajs/framework/utils"
import { PAYMENT_MODULE } from "../../../../../modules/payment"

/**
 * POST /admin/refunds/:id/reject
 * Finance admin rejects a pending refund.
 * Body: { rejection_reason }
 */
export async function POST(req: MedusaRequest, res: MedusaResponse) {
  const paymentService = req.scope.resolve(PAYMENT_MODULE) as any
  const { id } = req.params
  const body = req.body as any
  const actorId = (req as any).auth_context?.actor_id

  if (!actorId) {
    throw new MedusaError(MedusaError.Types.UNAUTHORIZED, "Authentication required")
  }

  if (!body.rejection_reason) {
    throw new MedusaError(MedusaError.Types.INVALID_DATA, "rejection_reason is required")
  }

  // Verify refund exists and is in a rejectable state
  const [refund] = await paymentService.listRefunds(
    { id },
    { select: ["id", "status"] }
  )

  if (!refund) {
    throw new MedusaError(MedusaError.Types.NOT_FOUND, `Refund ${id} not found`)
  }

  if (refund.status === "processed") {
    throw new MedusaError(
      MedusaError.Types.NOT_ALLOWED,
      `Refund ${id} has already been processed and cannot be rejected`
    )
  }

  if (refund.status === "rejected") {
    throw new MedusaError(
      MedusaError.Types.NOT_ALLOWED,
      `Refund ${id} has already been rejected`
    )
  }

  const updated = await paymentService.updateRefunds({
    id,
    status: "rejected",
    metadata: {
      rejection_reason: body.rejection_reason,
      rejected_by: actorId,
      rejected_at: new Date().toISOString(),
    },
  })

  return res.json({ refund: updated })
}
