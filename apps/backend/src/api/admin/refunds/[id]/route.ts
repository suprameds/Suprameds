import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { MedusaError } from "@medusajs/framework/utils"
import { PAYMENT_MODULE } from "../../../../modules/payment"

/**
 * GET /admin/refunds/:id
 * Retrieve a single refund with full details.
 */
export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const paymentService = req.scope.resolve(PAYMENT_MODULE) as any
  const { id } = req.params

  const [refund] = await paymentService.listRefunds({ id })

  if (!refund) {
    throw new MedusaError(MedusaError.Types.NOT_FOUND, `Refund ${id} not found`)
  }

  // Attach COD bank details if present
  let codDetails = null
  try {
    const [details] = await paymentService.listCodRefundDetails({ refund_id: id })
    codDetails = details ?? null
  } catch {
    // COD details are optional
  }

  return res.json({ refund: { ...refund, cod_refund_details: codDetails } })
}
