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
 *   - rejects emails already in use by a different customer
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

  // Uniqueness check — must not collide with a different customer
  const existing = await customerService.listCustomers({ email: normalised })
  if (existing.length > 0 && existing[0].id !== customerId) {
    return res.status(409).json({ message: "This email is already in use" })
  }

  const updated = await customerService.updateCustomers({
    id: customerId,
    email: normalised,
  })

  return res.json({ customer: updated })
}
