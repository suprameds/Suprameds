import {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import { Modules } from "@medusajs/framework/utils"

const PHONE_BRIDGE_RE = /@phone\.suprameds\.in$/i

/**
 * POST /store/profile/email — dedicated email-upgrade endpoint.
 *
 * OTP-only signups receive an auto-generated `{phone}@phone.suprameds.in`
 * placeholder email. This is the path for those customers to upgrade to
 * a real address.
 *
 * Behavior:
 *   - Validate email format (basic regex)
 *   - Reject the auto-generated placeholder format
 *   - Lowercase + trim before uniqueness check + write
 *   - Use `find` (not [0]) to catch a conflict at any index
 *   - Catch DB unique-constraint errors and map to a clean 409 (handles
 *     legacy mixed-case rows from email/password registration)
 *
 * Lives at /store/profile/ (not /store/customers/me/) because of a
 * historical medusa-cli/vite admin-build interaction with files under
 * /store/customers/. The .npmrc public-hoist-pattern fix in commit
 * 5419ee6 made fresh builds reliable, but we kept this path for
 * stability.
 */
export const POST = async (
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) => {
  const customerId = (req as any).auth_context?.actor_id
  if (!customerId) return res.status(401).json({ message: "Unauthorized" })

  const { email } = (req.body ?? {}) as { email?: string }
  if (!email || typeof email !== "string") {
    return res.status(400).json({ message: "Email is required" })
  }

  const normalised = email.trim().toLowerCase()
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalised)) {
    return res.status(400).json({ message: "Invalid email address" })
  }
  if (PHONE_BRIDGE_RE.test(normalised)) {
    return res.status(400).json({ message: "Please use a real email address" })
  }

  const customerService = req.scope.resolve(Modules.CUSTOMER) as any

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
    if (err?.code === "23505" || /unique/i.test(err?.message ?? "")) {
      return res.status(409).json({ message: "This email is already in use" })
    }
    throw err
  }

  return res.json({ customer: updated })
}
