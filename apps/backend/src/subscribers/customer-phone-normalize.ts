import type { SubscriberArgs, SubscriberConfig } from "@medusajs/framework"
import { Modules } from "@medusajs/framework/utils"
import { normalisePhone } from "../api/store/otp/otp-store"
import { captureException } from "../lib/sentry"
import { createLogger } from "../lib/logger"

const logger = createLogger("subscriber:customer-phone-normalize")

/**
 * Auto-normalises customer.phone to E.164-no-plus on every create/update.
 *
 * Why: phone has historically been written in three formats:
 *   - bare 10-digit         "9876543210"
 *   - E.164 without "+"     "919876543210"   ← canonical
 *   - E.164 with "+"        "+919876543210"
 *
 * When formats drift, OTP login can spawn duplicate accounts (it queries
 * `customer.phone = X` and misses an existing record stored as Y). The
 * OTP verify route now matches across formats, but stored data should
 * still be one canonical shape so admin lookups, exports, and any future
 * direct-equality query Just Works.
 *
 * Idempotency:
 *   - We compare the stored value to the canonical value; only UPDATE if
 *     they differ. The second pass through this subscriber (triggered by
 *     our own UPDATE) sees no diff and exits — no event-bus loop.
 *
 * Skip cases:
 *   - empty / null phone
 *   - phone that doesn't look Indian (10 digits starting 6-9 in the tail)
 *     — leave untouched, future international support shouldn't break.
 */
async function normalizeHandler({
  event: { data },
  container,
}: SubscriberArgs<{ id: string }>) {
  const customerId = data?.id
  if (!customerId) return

  try {
    const customerService = container.resolve(Modules.CUSTOMER) as any
    const customer = await customerService.retrieveCustomer(customerId)
    if (!customer?.phone) return

    const stored = String(customer.phone).trim()
    if (!stored) return

    // Only normalise Indian numbers — anything else, leave alone
    const tail = stored.replace(/\D/g, "").slice(-10)
    if (!/^[6-9]\d{9}$/.test(tail)) return

    const canonical = normalisePhone(stored, "91")
    if (canonical === stored) return

    await customerService.updateCustomers({
      id: customerId,
      phone: canonical,
    })

    logger.info(
      `Normalised phone for ${customerId}: "${stored}" → "${canonical}"`
    )
  } catch (err) {
    logger.warn(
      `Phone normalisation failed for ${customerId}: ${(err as Error).message}`
    )
    captureException(err, {
      subscriber: "customer-phone-normalize",
      customerId,
    })
  }
}

export default normalizeHandler

export const config: SubscriberConfig = {
  event: ["customer.created", "customer.updated"],
}
