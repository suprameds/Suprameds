import {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import { MedusaError } from "@medusajs/framework/utils"
import { PreDispatchCheckWorkflow } from "../../../../workflows/dispense/pre-dispatch-check"
import { DISPENSE_MODULE } from "../../../../modules/dispense"

/**
 * GET /admin/dispense/pre-dispatch?order_id=...
 * List pre-dispatch sign-offs, optionally filtered by order_id.
 */
export async function GET(
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) {
  const dispenseService = req.scope.resolve(DISPENSE_MODULE) as any
  const { order_id } = req.query as Record<string, string>

  const filters: Record<string, any> = {}
  if (order_id) {
    filters.order_id = order_id
  }

  const signOffs = await dispenseService.listPreDispatchSignOffs(filters)
  const list = Array.isArray(signOffs?.[0])
    ? signOffs[0]
    : Array.isArray(signOffs)
      ? signOffs
      : []

  return res.json({ sign_offs: list })
}

/**
 * POST /admin/dispense/pre-dispatch
 * Trigger the pre-dispatch check workflow for an order.
 * Body: { order_id: string, pharmacist_id: string }
 */
export async function POST(
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) {
  const body = req.body as any

  if (!body.order_id) {
    throw new MedusaError(
      MedusaError.Types.INVALID_DATA,
      "order_id is required"
    )
  }

  if (!body.pharmacist_id) {
    throw new MedusaError(
      MedusaError.Types.INVALID_DATA,
      "pharmacist_id is required"
    )
  }

  const { result, errors } = await PreDispatchCheckWorkflow(req.scope).run({
    input: {
      order_id: body.order_id,
      pharmacist_id: body.pharmacist_id,
    },
  })

  if (errors && errors.length > 0) {
    throw new MedusaError(
      MedusaError.Types.INVALID_DATA,
      errors[0].error?.message || "Pre-dispatch check workflow failed"
    )
  }

  return res.json({
    sign_off: result.sign_off,
    checklist: result.checklist,
    approved: result.approved,
    failures: result.failures,
  })
}
