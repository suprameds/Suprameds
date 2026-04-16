import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { MedusaError, Modules } from "@medusajs/framework/utils"
import { createLogger } from "../../../../../lib/logger"
import crypto from "crypto"

const logger = createLogger("store:pharmacist:customers:lookup")

/**
 * Normalize an Indian phone number to 10 digits.
 * Strips +91, 91 prefix, spaces, dashes, and validates length.
 * Returns empty string if the result is not exactly 10 digits.
 */
export function normalizePhone(raw: string): string {
  // Strip all non-digit characters
  let digits = raw.replace(/\D/g, "")

  // Strip +91 or 91 prefix (phone numbers starting with 91 followed by 10 digits)
  if (digits.length === 12 && digits.startsWith("91")) {
    digits = digits.slice(2)
  } else if (digits.length === 13 && digits.startsWith("91")) {
    // e.g. from +91 with extra leading char already stripped
    digits = digits.slice(3)
  }

  return digits.length === 10 ? digits : ""
}

/**
 * Search for an existing customer by phone, trying multiple prefix variants.
 */
export async function findCustomerByPhone(
  customerService: any,
  phone10: string
): Promise<any | null> {
  const variants = [`+91${phone10}`, phone10, `91${phone10}`]

  for (const variant of variants) {
    try {
      const [customers] = await customerService.listAndCountCustomers(
        { phone: variant },
        { select: ["id", "first_name", "last_name", "phone", "email"], relations: ["addresses"], take: 1 }
      )
      if (customers && customers.length > 0) {
        return customers[0]
      }
    } catch {
      // Try next variant
    }
  }

  return null
}

/**
 * Create a new customer with the given phone and optional name.
 * Uses a placeholder email and random password since the pharmacist
 * is creating this on behalf of the customer.
 */
export async function createCustomerWithPhone(
  customerService: any,
  phone10: string,
  firstName: string,
  lastName?: string
): Promise<any> {
  const email = `${phone10}@phone.suprameds.in`
  const password = crypto.randomBytes(32).toString("hex")

  try {
    const customer = await customerService.createCustomers({
      first_name: firstName,
      last_name: lastName || "",
      email,
      phone: `+91${phone10}`,
      metadata: { created_by: "pharmacist", password_placeholder: true },
    })
    return customer
  } catch (err: any) {
    // Handle race condition: if duplicate email/phone, try to find the customer
    if (
      err?.code === "23505" || // Postgres unique violation
      err?.message?.includes("duplicate") ||
      err?.message?.includes("unique") ||
      err?.message?.includes("already exists")
    ) {
      logger.warn("Duplicate customer detected, attempting lookup:", phone10)
      const existing = await findCustomerByPhone(customerService, phone10)
      if (existing) return existing
    }
    throw err
  }
}

/**
 * POST /store/pharmacist/customers/lookup
 *
 * Look up or quick-register a customer by phone number.
 *
 * Body: { phone: string, first_name?: string, last_name?: string }
 *
 * Returns:
 * - Found:     { found: true,  customer: { id, first_name, last_name, phone, email, addresses } }
 * - Not found: { found: false, customer: null }  (when no name provided)
 * - Created:   { found: false, customer: { ... } } (when name provided, auto-registers)
 */
export async function POST(req: MedusaRequest, res: MedusaResponse) {
  const { phone, first_name, last_name } = req.body as {
    phone?: string
    first_name?: string
    last_name?: string
  }

  if (!phone) {
    throw new MedusaError(
      MedusaError.Types.INVALID_DATA,
      "Phone number is required"
    )
  }

  const phone10 = normalizePhone(phone)
  if (!phone10) {
    throw new MedusaError(
      MedusaError.Types.INVALID_DATA,
      "Invalid phone number. Must be a valid 10-digit Indian mobile number."
    )
  }

  try {
    const customerService = req.scope.resolve(Modules.CUSTOMER)

    // Step 1: Try to find existing customer
    const existing = await findCustomerByPhone(customerService, phone10)
    if (existing) {
      return res.json({
        found: true,
        customer: {
          id: existing.id,
          first_name: existing.first_name,
          last_name: existing.last_name,
          phone: existing.phone,
          email: existing.email,
          addresses: existing.addresses ?? [],
        },
      })
    }

    // Step 2: Not found — if no name provided, return not-found
    if (!first_name) {
      return res.json({ found: false, customer: null })
    }

    // Step 3: Create new customer
    const created = await createCustomerWithPhone(
      customerService,
      phone10,
      first_name,
      last_name
    )

    logger.info(`Created customer ${created.id} for phone ${phone10}`)

    return res.json({
      found: false,
      customer: {
        id: created.id,
        first_name: created.first_name,
        last_name: created.last_name,
        phone: created.phone,
        email: created.email,
        addresses: created.addresses ?? [],
      },
    })
  } catch (err: any) {
    if (err instanceof MedusaError) throw err
    logger.error("Customer lookup failed:", err?.message)
    throw new MedusaError(
      MedusaError.Types.UNEXPECTED_STATE,
      "Failed to look up customer"
    )
  }
}
