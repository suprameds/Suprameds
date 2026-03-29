import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import {
  ContainerRegistrationKeys,
  generateJwtToken,
  MedusaError,
  Modules,
} from "@medusajs/framework/utils"
import {
  isValidIndianPhone,
  isValidEmail,
  normalisePhone,
  normaliseEmail,
  verifyOtp,
} from "../otp-store"

type OtpChannel = "sms" | "email"

interface VerifyOtpBody {
  phone?: string
  email?: string
  channel?: OtpChannel
  otp: string
  country_code?: string
}

const PHONE_PROVIDER = "phone-otp"
const EMAIL_OTP_PROVIDER = "email-otp"

/**
 * POST /store/otp/verify
 *
 * Verifies a 6-digit OTP (sent via SMS or Email), creates or retrieves
 * the customer, and returns a signed JWT bearer token.
 *
 * Body:
 *  - channel: "sms" | "email" (inferred from provided field)
 *  - phone: (required for sms channel)
 *  - email: (required for email channel)
 *  - otp: 6-digit string
 *  - country_code: default "91"
 */
export const POST = async (req: MedusaRequest, res: MedusaResponse) => {
  const logger = req.scope.resolve(ContainerRegistrationKeys.LOGGER) as any
  const body = req.body as VerifyOtpBody
  const { otp, country_code = "91" } = body

  if (!otp || !/^\d{6}$/.test(otp)) {
    throw new MedusaError(MedusaError.Types.INVALID_DATA, "OTP must be a 6-digit number")
  }

  // Determine channel and resolve identifier
  const channel: OtpChannel = body.channel || (body.email ? "email" : "sms")
  let identifier: string
  let provider: string
  let lookupField: "phone" | "email"

  if (channel === "email") {
    if (!body.email || !isValidEmail(body.email)) {
      throw new MedusaError(MedusaError.Types.INVALID_DATA, "Valid email address is required")
    }
    identifier = normaliseEmail(body.email)
    provider = EMAIL_OTP_PROVIDER
    lookupField = "email"
  } else {
    if (!body.phone || !isValidIndianPhone(body.phone)) {
      throw new MedusaError(MedusaError.Types.INVALID_DATA, "Valid Indian phone number is required")
    }
    identifier = normalisePhone(body.phone, country_code)
    provider = PHONE_PROVIDER
    lookupField = "phone"
  }

  // ── Verify OTP ─────────────────────────────────────────────────────
  const result = await verifyOtp(identifier, otp)
  if (!result.valid) {
    res.status(401).json({ success: false, message: result.reason ?? "Invalid OTP" })
    return
  }

  // ── Resolve Medusa services ────────────────────────────────────────
  const authModule = req.scope.resolve(Modules.AUTH) as any
  const customerModule = req.scope.resolve(Modules.CUSTOMER) as any

  // ── Find or create customer ────────────────────────────────────────
  let customer: { id: string; phone?: string; email?: string }

  const [existingCustomers] = await customerModule.listAndCountCustomers(
    { [lookupField]: identifier },
    { take: 1 },
  )

  if (existingCustomers.length > 0) {
    customer = existingCustomers[0]
    logger.info(`[otp/verify] Existing customer found via ${lookupField}`, { customer_id: customer.id })
  } else {
    customer = await customerModule.createCustomers({
      [lookupField]: identifier,
      has_account: true,
    })
    logger.info(`[otp/verify] New customer created via ${lookupField}`, { customer_id: customer.id })
  }

  // ── Find or create auth identity ───────────────────────────────────
  let authIdentity: {
    id: string
    app_metadata?: Record<string, unknown>
    provider_identities?: any[]
  }

  const [existingIdentities] = await authModule.listAndCountAuthIdentities({
    provider_identities: { entity_id: identifier, provider },
  })

  if (existingIdentities.length > 0) {
    authIdentity = existingIdentities[0]

    if (authIdentity.app_metadata?.customer_id !== customer.id) {
      authIdentity = await authModule.updateAuthIdentities({
        id: authIdentity.id,
        app_metadata: { ...authIdentity.app_metadata, customer_id: customer.id },
      })
    }
  } else {
    authIdentity = await authModule.createAuthIdentities({
      provider_identities: [
        {
          provider,
          entity_id: identifier,
          user_metadata: { [lookupField]: identifier },
        },
      ],
      app_metadata: { customer_id: customer.id },
    })
    logger.info(`[otp/verify] Auth identity created for ${provider}`, { auth_id: authIdentity.id })
  }

  // ── Generate JWT token ─────────────────────────────────────────────
  const jwtSecret = process.env.JWT_SECRET
  if (!jwtSecret) {
    throw new MedusaError(MedusaError.Types.UNEXPECTED_STATE, "JWT_SECRET is not configured")
  }

  const token = generateJwtToken(
    {
      actor_id: customer.id,
      actor_type: "customer",
      auth_identity_id: authIdentity.id,
      app_metadata: { customer_id: customer.id },
    },
    { secret: jwtSecret, expiresIn: "7d" },
  )

  logger.info(`[otp/verify] ${channel} login successful`, {
    customer_id: customer.id,
    channel,
    identifier: lookupField === "email" ? identifier : `${identifier.slice(0, 4)}****`,
  })

  res.json({ success: true, token, customer_id: customer.id })
}
