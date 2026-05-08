import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { Modules } from "@medusajs/framework/utils"

/**
 * POST /store/customers/me/email
 *
 * Dedicated email-update endpoint. Lets a customer upgrade their email
 * address — primarily used by OTP-only signups whose initial email is the
 * placeholder `{phone}@phone.suprameds.in`.
 *
 * Auth: requires authenticated customer (Medusa applies its default
 * `/store/customers/me*` authentication middleware to this path).
 *
 * Validation:
 *   - basic email format check
 *   - rejects the @phone.suprameds.in placeholder
 *   - rejects emails already in use by a different customer (scans ALL
 *     matches via find() — not just index 0 — so legacy duplicate rows
 *     can't sneak past the check when the requesting user happens to be
 *     listed first)
 *   - falls back to a clean 409 if the DB unique constraint trips at write
 *     time (covers the case where a different-cased duplicate exists from
 *     legacy email/password registration that wrote whatever the user typed)
 */

const PHONE_BRIDGE_RE = /@phone\.suprameds\.in$/i
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export const POST = async (req: MedusaRequest, res: MedusaResponse) => {
  const customerId = (req as any).auth_context?.actor_id
  if (!customerId) {
    return res.status(401).json({ message: "Unauthorized" })
  }

  const { email } = (req.body ?? {}) as { email?: string }

  if (!email || typeof email !== "string" || !EMAIL_RE.test(email.trim())) {
    return res.status(400).json({ message: "Invalid email address" })
  }

  const normalised = email.trim().toLowerCase()

  if (PHONE_BRIDGE_RE.test(normalised)) {
    return res.status(400).json({ message: "Please use a real email address" })
  }

  const customerService = req.scope.resolve(Modules.CUSTOMER) as any

  // Uniqueness check — query against the lowercase form (we always write
  // lowercase via this route, so any future collision will share casing).
  // Legacy email/password registration could have written mixed-case emails;
  // those are caught by the DB unique-constraint catch below.
  //
  // Use find() — not existing[0] — so that if multiple rows match (legacy
  // dirty data, soft-deleted resurfacing) we still catch a conflict even
  // when the requesting customer happens to be index 0.
  const existing = await customerService.listCustomers({ email: normalised })
  const conflict = existing.find((c: { id: string }) => c.id !== customerId)
  if (conflict) {
    return res.status(409).json({ message: "This email is already in use" })
  }

  let updated
  try {
    updated = await customerService.updateCustomers({
      id: customerId,
      email: normalised,
    })
  } catch (err: any) {
    // Postgres unique-constraint violation (23505) → another customer holds
    // a different-cased version of this email. Surface as a clean 409 instead
    // of a 500.
    if (err?.code === "23505" || /unique/i.test(err?.message ?? "")) {
      return res.status(409).json({ message: "This email is already in use" })
    }
    throw err
  }

  return res.json({ customer: updated })
}
