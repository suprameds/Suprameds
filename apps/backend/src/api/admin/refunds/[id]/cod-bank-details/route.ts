import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { MedusaError } from "@medusajs/framework/utils"
import { PAYMENT_MODULE } from "../../../../../modules/payment"

/**
 * POST /admin/refunds/:id/cod-bank-details
 * Submit or update bank/UPI details for a COD refund.
 * Body: { account_holder_name, bank_name, account_number, ifsc_code, upi_id? }
 */
export async function POST(req: MedusaRequest, res: MedusaResponse) {
  const paymentService = req.scope.resolve(PAYMENT_MODULE) as any
  const { id } = req.params
  const body = req.body as any
  const actorId = (req as any).auth_context?.actor_id

  if (!actorId) {
    throw new MedusaError(MedusaError.Types.UNAUTHORIZED, "Authentication required")
  }

  // Validate required fields
  if (!body.account_holder_name) {
    throw new MedusaError(MedusaError.Types.INVALID_DATA, "account_holder_name is required")
  }
  if (!body.bank_name) {
    throw new MedusaError(MedusaError.Types.INVALID_DATA, "bank_name is required")
  }
  if (!body.account_number) {
    throw new MedusaError(MedusaError.Types.INVALID_DATA, "account_number is required")
  }
  if (!body.ifsc_code) {
    throw new MedusaError(MedusaError.Types.INVALID_DATA, "ifsc_code is required")
  }

  // Validate IFSC format (11 characters, first 4 alpha, 5th is 0, last 6 alphanumeric)
  const ifscRegex = /^[A-Z]{4}0[A-Z0-9]{6}$/
  if (!ifscRegex.test(body.ifsc_code.toUpperCase())) {
    throw new MedusaError(
      MedusaError.Types.INVALID_DATA,
      "ifsc_code must be in valid IFSC format (e.g., HDFC0001234)"
    )
  }

  // Verify refund exists
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
      `Refund ${id} has already been processed`
    )
  }

  // Check if record already exists (upsert pattern)
  const [existing] = await paymentService.listCodRefundDetails({ refund_id: id })

  let codDetails
  if (existing) {
    codDetails = await paymentService.updateCodRefundDetails({
      id: existing.id,
      account_holder_name: body.account_holder_name,
      bank_name: body.bank_name,
      account_number: body.account_number,
      ifsc_code: body.ifsc_code.toUpperCase(),
      upi_id: body.upi_id ?? null,
      // Reset verified flag when details are updated
      verified: false,
    })
  } else {
    codDetails = await paymentService.createCodRefundDetails({
      refund_id: id,
      account_holder_name: body.account_holder_name,
      bank_name: body.bank_name,
      account_number: body.account_number,
      ifsc_code: body.ifsc_code.toUpperCase(),
      upi_id: body.upi_id ?? null,
      verified: false,
    })
  }

  return res.status(existing ? 200 : 201).json({ cod_refund_details: codDetails })
}
