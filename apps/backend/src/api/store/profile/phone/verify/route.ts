import {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import {
  isValidIndianPhone,
  normalisePhone,
  verifyOtp,
} from "../../../otp/otp-store"

const KEY_PREFIX = "pchg:"

/**
 * POST /store/profile/phone/verify
 *
 * Step 2 of the verified phone-change flow. Reads the OTP the user just
 * received on the new phone and, on a match, writes customer.phone.
 *
 * The customer-phone-normalize subscriber will then re-canonicalise (no-op
 * here since we already store the normalised form, but harmless).
 */
export const POST = async (
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) => {
  const customerId = (req as any).auth_context?.actor_id
  if (!customerId) {
    return res.status(401).json({ message: "Unauthorized" })
  }

  const logger = req.scope.resolve(ContainerRegistrationKeys.LOGGER) as any

  const { phone, otp } = (req.body ?? {}) as { phone?: string; otp?: string }
  if (!phone || typeof phone !== "string") {
    return res.status(400).json({ message: "Phone is required" })
  }
  if (!otp || typeof otp !== "string" || !/^\d{6}$/.test(otp)) {
    return res.status(400).json({ message: "Enter the 6-digit OTP" })
  }
  if (!isValidIndianPhone(phone)) {
    return res
      .status(400)
      .json({ message: "Phone must be a valid 10-digit Indian mobile" })
  }

  const newPhone = normalisePhone(phone, "91")
  const storeKey = `${KEY_PREFIX}${customerId}:${newPhone}`

  const result = await verifyOtp(storeKey, otp)
  if (!result.valid) {
    return res
      .status(400)
      .json({ message: result.reason || "Invalid OTP" })
  }

  // Write the new phone. The customer-phone-normalize subscriber listens to
  // customer.updated and re-checks the canonical form (idempotent here).
  const customerService = req.scope.resolve(Modules.CUSTOMER) as any
  let updated
  try {
    updated = await customerService.updateCustomers({
      id: customerId,
      phone: newPhone,
    })
  } catch (err: any) {
    logger.error(
      `[profile/phone/verify] Failed to update phone for ${customerId}: ${err?.message}`
    )
    return res
      .status(500)
      .json({ message: "Failed to update phone. Please try again." })
  }

  logger.info(
    `[profile/phone/verify] Phone updated for ${customerId} → ${newPhone.slice(
      0,
      4
    )}****${newPhone.slice(-2)}`
  )

  return res.json({ customer: updated })
}
