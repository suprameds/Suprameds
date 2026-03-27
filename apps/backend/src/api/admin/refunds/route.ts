import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { MedusaError } from "@medusajs/framework/utils"
import { PAYMENT_MODULE } from "../../../modules/payment"
import { RaiseRefundWorkflow } from "../../../workflows/payment/raise-refund"

const VALID_REASONS = [
  "rejected_rx_line",
  "cancelled_order",
  "return",
  "batch_recall",
  "payment_capture_error",
  "cod_non_delivery",
  "other",
] as const

/**
 * GET /admin/refunds
 * List refunds with optional filters.
 * Query params: status, order_id, raised_by, limit, offset
 */
export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const paymentService = req.scope.resolve(PAYMENT_MODULE) as any

  const { status, order_id, raised_by, limit = "20", offset = "0" } =
    req.query as Record<string, string>

  const filters: Record<string, any> = {}
  if (status) filters.status = status
  if (order_id) filters.order_id = order_id
  if (raised_by) filters.raised_by = raised_by

  const refunds = await paymentService.listRefunds(filters, {
    take: parseInt(limit, 10),
    skip: parseInt(offset, 10),
    order: { created_at: "DESC" },
  })

  const list = Array.isArray(refunds?.[0])
    ? refunds[0]
    : Array.isArray(refunds)
    ? refunds
    : []

  return res.json({ refunds: list, count: list.length })
}

/**
 * POST /admin/refunds
 * Raise a new refund request (support_agent).
 * Body: { order_id, payment_id, reason, amount, items? }
 */
export async function POST(req: MedusaRequest, res: MedusaResponse) {
  const body = req.body as any
  const actorId = (req as any).auth_context?.actor_id

  if (!body.order_id) {
    throw new MedusaError(MedusaError.Types.INVALID_DATA, "order_id is required")
  }
  if (!body.payment_id) {
    throw new MedusaError(MedusaError.Types.INVALID_DATA, "payment_id is required")
  }
  if (!body.reason || !VALID_REASONS.includes(body.reason)) {
    throw new MedusaError(
      MedusaError.Types.INVALID_DATA,
      `reason must be one of: ${VALID_REASONS.join(", ")}`
    )
  }
  if (!body.amount || body.amount <= 0) {
    throw new MedusaError(MedusaError.Types.INVALID_DATA, "amount must be a positive number")
  }
  if (!actorId) {
    throw new MedusaError(MedusaError.Types.UNAUTHORIZED, "Authentication required")
  }

  const { result, errors } = await RaiseRefundWorkflow(req.scope).run({
    input: {
      order_id: body.order_id,
      payment_id: body.payment_id,
      reason: body.reason,
      amount: body.amount,
      raised_by: actorId,
      items: body.items,
    },
  })

  if (errors && errors.length > 0) {
    throw new MedusaError(
      MedusaError.Types.INVALID_DATA,
      errors[0].error?.message || "Raise refund workflow failed"
    )
  }

  return res.status(201).json({ refund: result })
}
