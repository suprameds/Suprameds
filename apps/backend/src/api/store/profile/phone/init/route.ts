import {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import {
  canSendOtp,
  generateOtp,
  isValidIndianPhone,
  normalisePhone,
  storeOtp,
} from "../../../otp/otp-store"

/**
 * Phone-change OTP key prefix.
 *
 * Distinct from the login OTP key (which is just the bare phone number) so a
 * login-flow OTP can never accidentally validate a phone change. The verify
 * route uses the same prefix.
 */
const KEY_PREFIX = "pchg:"

/**
 * POST /store/profile/phone/init
 *
 * Step 1 of the verified phone-change flow.
 *   - Authenticated request (customer already logged in).
 *   - Validates the new phone (10-digit Indian mobile, starts 6-9).
 *   - Normalises to E.164-no-plus.
 *   - Rate-limits per (customer + new phone) pair.
 *   - Sends an OTP via BulkSMS, just like login.
 *
 * Does NOT mutate customer.phone yet — that happens in /verify after the OTP
 * is matched. This prevents a typo from locking the user out of OTP login.
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

  const { phone } = (req.body ?? {}) as { phone?: string }
  if (!phone || typeof phone !== "string") {
    return res.status(400).json({ message: "Phone is required" })
  }

  if (!isValidIndianPhone(phone)) {
    return res.status(400).json({
      message:
        "Enter a valid 10-digit Indian mobile number (starts with 6-9).",
    })
  }

  const newPhone = normalisePhone(phone, "91")

  // Reject if the new phone matches the current phone — nothing to do.
  const customerService = req.scope.resolve(Modules.CUSTOMER) as any
  const customer = await customerService.retrieveCustomer(customerId)
  if (customer?.phone === newPhone) {
    return res.status(400).json({
      message: "This is already your phone number.",
    })
  }

  // Surface (don't block) when another customer already owns this phone.
  // Legitimate cases exist (family / staff sharing one number) but worth
  // letting the user know OTP login routing may not behave as expected.
  const [conflicts] = await customerService.listAndCountCustomers(
    { phone: newPhone },
    { take: 5 }
  )
  const otherOwners = conflicts.filter(
    (c: { id: string }) => c.id !== customerId
  ).length

  // Rate-limit by (customer + phone). Using customerId in the key means
  // changing the same destination phone repeatedly throttles per-user,
  // not globally.
  const rateKey = `${KEY_PREFIX}${customerId}:${newPhone}`
  const allowed = await canSendOtp(rateKey)
  if (!allowed) {
    return res.status(429).json({
      message: "Too many OTP requests. Please try again in a few minutes.",
    })
  }

  // Generate, store, send
  const otp = generateOtp()
  const storeKey = `${KEY_PREFIX}${customerId}:${newPhone}`
  await storeOtp(storeKey, otp)

  const smsOk = await sendViaBulkSms(newPhone, otp, logger)
  if (!smsOk) {
    return res.status(503).json({
      message:
        "SMS service is temporarily unavailable. Please try again later.",
    })
  }

  logger.info(
    `[profile/phone/init] OTP sent to ${newPhone.slice(0, 4)}****${newPhone.slice(
      -2
    )} for customer ${customerId}`
  )

  return res.json({
    success: true,
    masked_phone: `${newPhone.slice(0, 4)}****${newPhone.slice(-2)}`,
    other_owners_count: otherOwners,
  })
}

/** Send OTP via BulkSMSPlans.com HTTP API. Mirrors /store/otp/send. */
async function sendViaBulkSms(
  phone: string,
  otp: string,
  logger: any
): Promise<boolean> {
  const apiId = process.env.BULKSMS_API_ID
  const apiPassword = process.env.BULKSMS_API_PASSWORD
  const senderId = process.env.BULKSMS_SENDER_ID || "Suprra"
  const templateId = process.env.BULKSMS_DLT_OTP_TEMPLATE_ID || ""

  if (!apiId || !apiPassword) {
    logger.debug("[profile/phone/init] BulkSMS not configured, skipping")
    return false
  }

  const message = `${otp} is your verification code for SUPRAMEDS.`

  try {
    const params = new URLSearchParams({
      api_id: apiId,
      api_password: apiPassword,
      sms_type: "OTP",
      sms_encoding: "text",
      sender: senderId,
      number: phone,
      message,
      ...(templateId ? { template_id: templateId } : {}),
    })

    const response = await fetch(
      `https://www.bulksmsplans.com/api/send_sms?${params.toString()}`
    )
    const result = (await response.json()) as Record<string, unknown>

    if (!response.ok || result.status === "error") {
      logger.warn(
        `[profile/phone/init] BulkSMS failed: ${JSON.stringify(result)}`
      )
      return false
    }

    return true
  } catch (err: unknown) {
    logger.warn(
      `[profile/phone/init] BulkSMS error: ${(err as Error).message}`
    )
    return false
  }
}
