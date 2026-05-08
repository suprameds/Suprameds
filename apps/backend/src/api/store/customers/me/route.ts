import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { Modules } from "@medusajs/framework/utils"
import { updateCustomersWorkflow } from "@medusajs/core-flows"

/**
 * POST /store/customers/me — defensive override of Medusa's default.
 *
 * In Medusa v2, file-based routes at this path FULLY REPLACE the framework
 * default (no chaining). We reimplement the handler so we can enforce two
 * project-specific constraints that the default does not:
 *
 *   1. Email changes must go through POST /store/customers/me/email
 *      (the dedicated endpoint runs the @phone.suprameds.in placeholder
 *      check + uniqueness check that this generic route can't sensibly do).
 *   2. Server-only metadata keys (`kyc_status`, `verified_phone`) cannot
 *      be written by the client — those are reserved for compliance jobs.
 *
 * Allowed fields: first_name, last_name, phone, and any non-server metadata
 * (dob, gender, allergies, chronic_conditions, abha_id, emergency_contact,
 * preferred_language, gst_number, consent_marketing, consent_terms,
 * referred_by, plus future additions). The metadata list is intentionally
 * open — we use a denial list rather than an allow list to keep the route
 * permissive for future fields.
 *
 * The actual write is dispatched through `updateCustomersWorkflow` (Medusa's
 * public core-flow). This guarantees parity with the framework default:
 *   • emits the `customer.updated` event so subscribers (analytics, search
 *     reindex, audit log) see self-service profile changes
 *   • runs the `customersUpdated` workflow hook so downstream extensions can
 *     attach behaviour without monkey-patching this route
 *
 * Response shape mirrors the default: customer hydrated with `addresses`
 * (so the storefront cache doesn't lose `default_shipping_address_id` etc.
 * after a profile save).
 *
 * Auth is provided by Medusa's default `/store/customers/me*` middleware.
 */

const SERVER_ONLY_METADATA_KEYS = new Set(["kyc_status", "verified_phone"])

interface UpdateBody {
  first_name?: string | null
  last_name?: string | null
  email?: string
  phone?: string | null
  company_name?: string | null
  metadata?: Record<string, unknown> | null
}

export const POST = async (req: MedusaRequest, res: MedusaResponse) => {
  const customerId = (req as any).auth_context?.actor_id
  if (!customerId) {
    return res.status(401).json({ message: "Unauthorized" })
  }

  const body = (req.body ?? {}) as UpdateBody

  // ── Reject email writes via this route ──────────────────────────────
  if (body.email !== undefined) {
    return res.status(400).json({
      message: "Use POST /store/customers/me/email to change your email",
    })
  }

  // ── Reject server-only metadata writes ──────────────────────────────
  if (body.metadata) {
    for (const key of Object.keys(body.metadata)) {
      if (SERVER_ONLY_METADATA_KEYS.has(key)) {
        return res.status(400).json({
          message: `Field 'metadata.${key}' cannot be set by the client`,
        })
      }
    }
  }

  const customerService = req.scope.resolve(Modules.CUSTOMER) as any

  // Merge metadata so partial writes don't wipe existing keys
  let mergedMetadata: Record<string, unknown> | undefined
  if (body.metadata) {
    const existing = await customerService.retrieveCustomer(customerId)
    mergedMetadata = {
      ...((existing.metadata as Record<string, unknown>) ?? {}),
      ...body.metadata,
    }
  }

  // Build the update payload — only forward defined keys
  const update: Record<string, unknown> = {}
  if (body.first_name !== undefined) update.first_name = body.first_name
  if (body.last_name !== undefined) update.last_name = body.last_name
  if (body.phone !== undefined) update.phone = body.phone
  if (body.company_name !== undefined) update.company_name = body.company_name
  if (mergedMetadata !== undefined) update.metadata = mergedMetadata

  // Run through the public workflow so the `customer.updated` event fires
  // and the `customersUpdated` hook is exposed to downstream extensions.
  await updateCustomersWorkflow(req.scope).run({
    input: {
      selector: { id: customerId },
      update: update as any,
    },
  })

  // Re-hydrate with `addresses` to match the default response shape.
  // The storefront writes the response into its React Query cache, so missing
  // relations would silently break UI that reads e.g.
  // `customer.default_shipping_address_id` / `customer.addresses` until the
  // 15-min staleTime elapses.
  const hydrated = await customerService.retrieveCustomer(customerId, {
    relations: ["addresses"],
  })

  return res.json({ customer: hydrated })
}
