import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import type { CustomerDTO, ProviderIdentityDTO } from "@medusajs/types"
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
  const authModule = req.scope.resolve(Modules.AUTH)
  const customerModule = req.scope.resolve(Modules.CUSTOMER)
  const pg = req.scope.resolve(ContainerRegistrationKeys.PG_CONNECTION)

  // ── Find or create customer ────────────────────────────────────────
  let customer: CustomerDTO
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
  let authIdentity!: {
    id: string
    app_metadata?: Record<string, unknown>
    provider_identities?: any[]
  }

  // Capture a device snapshot from the request — what OS/browser/platform
  // logged in. Used by admin to spot "Pavani logged in from a new Android
  // device" and to power coarse device analytics. See ../device-parser.ts.
  const device = parseDevice(req)

  // Build phone-format variants of entity_id so an identity stored under a
  // different historical format (10-digit legacy vs 12-digit E.164 vs
  // +E.164) is still matched. Email is single canonical form.
  const entityIdVariants: string[] = (() => {
    if (channel !== "sms") return [identifier]
    const tenDigit = identifier.length > 10 ? identifier.slice(-10) : identifier
    const fullForm = identifier.length > 10 ? identifier : `${country_code}${identifier}`
    return [fullForm, tenDigit, `+${fullForm}`]
  })()

  // Find the existing provider identity. Bulletproof strategy:
  //
  // History: earlier attempts used filter shapes that Medusa v2.13's filter
  // pipeline doesn't reliably resolve (nested filter on the one-to-many
  // relation, or methods that don't actually exist on the auth module). Each
  // failed lookup fell through to createAuthIdentities which then threw
  // "Provider identity with entity_id: …, already exists" because of the
  // UNIQUE(provider, entity_id) constraint on provider_identities.
  //
  // Today's approach has two strategies in sequence and either is enough:
  //
  //   1. Per-variant filtered lookup (cheap, works in most cases).
  //   2. List ALL provider identities for this provider and match
  //      client-side (guaranteed-correct, regardless of any quirk in the
  //      filter pipeline). The provider_identity table is small (<200 rows
  //      total in practice), so a full scan per login is acceptable as a
  //      safety net.
  //
  // We also match all phone-format variants of entity_id (10-digit legacy +
  // 12-digit E.164 + with-plus) so an identity stored under any historical
  // format is still resolved.
  const findExistingProviderIdentity = async (): Promise<ProviderIdentityDTO | null> => {
    // Strategy 1: filtered lookup per variant
    for (const variant of entityIdVariants) {
      const matches = await authModule.listProviderIdentities({
        provider,
        entity_id: variant,
      })
      if (matches.length > 0) return matches[0]
    }
    // Strategy 2: list-all + client-side filter (bulletproof fallback)
    // Take a big chunk so we don't get tripped up by the default take=15.
    const all = await authModule.listProviderIdentities(
      { provider },
      { take: 1000 },
    )
    const variantSet = new Set(entityIdVariants)
    const found = all.find((p: any) => variantSet.has(p.entity_id))
    if (found) {
      logger.info(
        `[otp/verify] Provider identity resolved via list-all fallback (entity_id=${found.entity_id})`,
      )
      return found
    }
    return null
  }

  let providerIdentity = await findExistingProviderIdentity()

  // If we found a provider_identity but the auth_identity it points at is
  // gone (Medusa's soft-delete cascade missed provider_identity when the
  // customer was deleted — see 2026-05-21 incident), hard-delete the dangling
  // row and treat it as a cache miss so the create-path below runs cleanly.
  //
  // Hard-delete (not soft-delete) is required: the UNIQUE(entity_id, provider)
  // index on provider_identity is not partial on deleted_at, so a tombstoned
  // row still occupies the slot and the next INSERT would hit a UNIQUE
  // violation. We bypass Medusa's deleteProviderIdentities (soft) and use
  // raw SQL for an actual DELETE.
  if (providerIdentity?.auth_identity_id) {
    try {
      authIdentity = await authModule.retrieveAuthIdentity(providerIdentity.auth_identity_id)
    } catch (err: any) {
      const isNotFound =
        err?.type === MedusaError.Types.NOT_FOUND ||
        /not[ _-]?found/i.test(err?.message ?? "")
      if (!isNotFound) throw err
      logger.warn(
        `[otp/verify] Orphan provider_identity ${providerIdentity.id} (provider=${providerIdentity.provider}, entity_id=${providerIdentity.entity_id}) points at dead auth_identity ${providerIdentity.auth_identity_id} — hard-deleting and falling through to create path.`,
      )
      await pg.raw(`DELETE FROM provider_identity WHERE id = ?`, [providerIdentity.id])
      providerIdentity = null
    }
  }

  if (providerIdentity) {
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
      // Recovery: a concurrent request, an orphaned identity, or a stale
      // identity from a previous broken-lookup login already owns
      // (provider, entity_id). Medusa v2.13 wraps this as
      // `MedusaError(INVALID_DATA, "Provider identity with entity_id: <e>, provider: <p>, already exists.")`.
      // We re-fetch the existing identity and reuse it instead of failing
      // the login.
      const message = (err?.message ?? "").toString()
      const isAlreadyExists =
        err?.code === "23505" ||
        err?.type === "invalid_data" ||
        /already exists|unique|duplicate|entity_id/i.test(message)
      if (!isAlreadyExists) throw err

      logger.warn(
        `[otp/verify] Duplicate provider identity on create — recovering: ${message}`,
      )
      const recovered = await findExistingProviderIdentity()
      if (!recovered?.auth_identity_id) {
        // The error said the identity exists but neither strategy could find
        // it (or the matched row has no auth_identity_id, which would be a
        // data-integrity problem). Surface a more debuggable error than the
        // raw 'already exists'.
        logger.error(
          `[otp/verify] Duplicate reported but both lookup strategies returned empty (or missing auth_identity_id) for entity_id variants: ${entityIdVariants.join(", ")}`,
        )
        throw err
      }
      authIdentity = await authModule.retrieveAuthIdentity(recovered.auth_identity_id)

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
    // Matches http.jwtExpiresIn in medusa-config.ts — customers stay signed in
    // until they explicitly log out.
    { secret: jwtSecret, expiresIn: "3650d" },
  )

  logger.info(`[otp/verify] ${channel} login successful`, {
    customer_id: customer.id,
    channel,
    identifier: lookupField === "email" ? identifier : `${identifier.slice(0, 4)}****`,
  })

  res.json({ success: true, token, customer_id: customer.id, is_new: isNew })
}
