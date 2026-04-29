import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { Modules } from "@medusajs/framework/utils"
import { normalizePhone } from "../lookup/route"
import { createLogger } from "../../../../../lib/logger"

const logger = createLogger("store:pharmacist:customers:search")

const CUSTOMER_FIELDS = ["id", "first_name", "last_name", "phone", "email"]

/**
 * GET /store/pharmacist/customers/search?q=<term>
 *
 * Searches customers by:
 *   - Phone (exact 10-digit match, tries +91/91 prefix variants) when q is digits
 *   - First name OR last name (case-insensitive prefix match) when q is text
 *   - Mixed (e.g. "Raj 9876") — tries name first, then phone portion
 *
 * Returns up to 10 matches.
 */
export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const q = ((req.query.q as string) || "").trim()

  if (!q || q.length < 2) {
    return res.json({ customers: [] })
  }

  const customerService = req.scope.resolve(Modules.CUSTOMER) as any
  const results: any[] = []

  try {
    // Detect if query is purely numeric (phone search)
    const digitsOnly = q.replace(/\D/g, "")
    const isPhoneQuery = /^\d+$/.test(q.replace(/[\s\-+]/g, ""))

    if (isPhoneQuery && digitsOnly.length >= 6) {
      // Phone-based search — try all prefix variants
      const phone10 = normalizePhone(q)
      const variants = phone10
        ? [`+91${phone10}`, phone10, `91${phone10}`]
        : [`+91${digitsOnly}`, digitsOnly]

      for (const variant of variants) {
        try {
          const [customers] = await customerService.listAndCountCustomers(
            { phone: variant },
            { select: CUSTOMER_FIELDS, relations: ["addresses"], take: 10 }
          )
          for (const c of customers ?? []) {
            if (!results.find((r) => r.id === c.id)) results.push(c)
          }
        } catch {
          // Variant not found — continue
        }
      }
    } else {
      // Name-based search — first name and last name separately
      const [byFirst] = await customerService.listAndCountCustomers(
        { first_name: q },
        { select: CUSTOMER_FIELDS, relations: ["addresses"], take: 10 }
      ).catch(() => [[]])

      const [byLast] = await customerService.listAndCountCustomers(
        { last_name: q },
        { select: CUSTOMER_FIELDS, relations: ["addresses"], take: 10 }
      ).catch(() => [[]])

      for (const c of [...(byFirst ?? []), ...(byLast ?? [])]) {
        if (!results.find((r) => r.id === c.id)) results.push(c)
      }
    }
  } catch (err: any) {
    logger.error("Customer search failed:", err?.message)
    return res.status(500).json({ error: "Search failed" })
  }

  return res.json({
    customers: results.slice(0, 10).map((c) => ({
      id: c.id,
      first_name: c.first_name,
      last_name: c.last_name,
      phone: c.phone,
      email: c.email,
      addresses: c.addresses ?? [],
    })),
  })
}
