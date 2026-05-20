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
import { parseDevice, mergeDevice } from "../device-parser"

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
  let isNew: boolean

  // Phone storage has historically used two formats:
  //   - 10-digit  (legacy email/password registration):    "9876543210"
  //   - E.164 no-+ (this OTP route, via normalisePhone):   "919876543210"
  // Match both so an existing customer isn't accidentally duplicated when
  // they sign in via OTP for the first time. Email is a single canonical
  // (lowercased + trimmed) form so we match it directly.
  let lookupValue: any = identifier
  if (channel === "sms") {
    const tenDigit = identifier.length > 10 ? identifier.slice(-10) : identifier
    const fullForm = identifier.length > 10 ? identifier : `${country_code}${identifier}`
    lookupValue = { $in: [fullForm, tenDigit, `+${fullForm}`] }
  }

  // Order by created_at ASC so the OLDEST matching customer wins. Important
  // when a duplicate has already been created — we want OTP to log into the
  // original account, not the orphan.
  const [existingCustomers] = await customerModule.listAndCountCustomers(
    { [lookupField]: lookupValue },
    { take: 1, order: { created_at: "ASC" } },
  )

  if (existingCustomers.length > 0) {
    customer = existingCustomers[0]
    isNew = false
    logger.info(`[otp/verify] Existing customer found via ${lookupField}`, { customer_id: customer.id })
  } else {
    customer = await customerModule.createCustomers({
      [lookupField]: identifier,
      has_account: true,
    })
    isNew = true
    logger.info(`[otp/verify] New customer created via ${lookupField}`, { customer_id: customer.id })
  }

  // ── Find or create auth identity ───────────────────────────────────
  let authIdentity: {
    id: string
    app_metadata?: Record<string, unknown>
    provider_identities?: any[]
  }

  // Capture a device snapshot from the request — what OS/browser/platform
  // logged in. Used by admin to spot "Pavani logged in from a new Android
  // device" and to power coarse device analytics. See ../device-parser.ts.
  const device = parseDevice(req)

  // Find the existing provider identity directly. The earlier code used
  // `listAndCountAuthIdentities({ provider_identities: { entity_id, provider } })`
  // — a nested filter through the one-to-many relation that DOES NOT
  // reliably resolve in Medusa v2.13's filter pipeline and always returned
  // an empty array. That made every login attempt fall through to
  // createAuthIdentities, which then failed on the second attempt because
  // the (provider, entity_id) pair already exists with a UNIQUE constraint
  // — producing the user-visible "entity_id" error on retry.
  //
  // We also match all phone-format variants of entity_id (10-digit legacy +
  // 12-digit E.164 + with-plus) so an identity stored under a different
  // format isn't accidentally duplicated.
  const entityIdVariants: string[] = [identifier]
  if (channel === "sms") {
    const tenDigit = identifier.length > 10 ? identifier.slice(-10) : identifier
    const fullForm = identifier.length > 10 ? identifier : `${country_code}${identifier}`
    entityIdVariants.splice(0, entityIdVariants.length, fullForm, tenDigit, `+${fullForm}`)
  }

  let providerIdentity: { id: string; entity_id: string; auth_identity_id: string } | null = null
  try {
    const [matches] = await authModule.listAndCountProviderIdentities({
      provider,
      entity_id: { $in: entityIdVariants },
    })
    providerIdentity = matches[0] ?? null
  } catch (err) {
    // If the filter syntax is unsupported in the running Medusa version, fall back
    // to listing all provider identities for the provider (small dataset in practice)
    // and matching client-side. Still beats the previous always-empty result.
    const [allForProvider] = await authModule.listAndCountProviderIdentities({ provider })
    providerIdentity = allForProvider.find((p: any) => entityIdVariants.includes(p.entity_id)) ?? null
    logger.warn(`[otp/verify] $in filter failed on provider_identities, fell back to manual scan: ${(err as Error).message}`)
  }

  if (providerIdentity) {
    authIdentity = await authModule.retrieveAuthIdentity(providerIdentity.auth_identity_id)
    const prevMeta = authIdentity.app_metadata || {}
    const nextDevices = device
      ? mergeDevice(
          (prevMeta as Record<string, unknown>).last_devices,
          device
        )
      : (prevMeta as Record<string, unknown>).last_devices

    if (
      authIdentity.app_metadata?.customer_id !== customer.id ||
      device // refresh the device list on every login
    ) {
      authIdentity = await authModule.updateAuthIdentities({
        id: authIdentity.id,
        app_metadata: {
          ...prevMeta,
          customer_id: customer.id,
          ...(nextDevices ? { last_devices: nextDevices } : {}),
        },
      })
    }
  } else {
    try {
      authIdentity = await authModule.createAuthIdentities({
        provider_identities: [
          {
            provider,
            entity_id: identifier,
            user_metadata: { [lookupField]: identifier },
          },
        ],
        app_metadata: {
          customer_id: customer.id,
          ...(device ? { last_devices: [device] } : {}),
        },
      })
      logger.info(`[otp/verify] Auth identity created for ${provider}`, { auth_id: authIdentity.id })
    } catch (err: any) {
      // Race-condition recovery: a concurrent request created the identity
      // between our lookup and create. Re-fetch and reuse instead of failing.
      const isUniqueConflict =
        err?.code === "23505" ||
        /unique|duplicate|entity_id/i.test(err?.message ?? "")
      if (!isUniqueConflict) throw err

      logger.warn(`[otp/verify] Race-condition duplicate on auth identity, recovering: ${err.message}`)
      const [retryMatches] = await authModule.listAndCountProviderIdentities({
        provider,
        entity_id: { $in: entityIdVariants },
      })
      if (retryMatches.length === 0) throw err
      authIdentity = await authModule.retrieveAuthIdentity(retryMatches[0].auth_identity_id)

      // Make sure the recovered identity points at our customer
      if (authIdentity.app_metadata?.customer_id !== customer.id) {
        authIdentity = await authModule.updateAuthIdentities({
          id: authIdentity.id,
          app_metadata: { ...(authIdentity.app_metadata ?? {}), customer_id: customer.id },
        })
      }
    }
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

  res.json({ success: true, token, customer_id: customer.id, is_new: isNew })
}
