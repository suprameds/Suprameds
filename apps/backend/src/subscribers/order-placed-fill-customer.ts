import type { SubscriberArgs, SubscriberConfig } from "@medusajs/framework"
import { Modules } from "@medusajs/framework/utils"
import { captureException } from "../lib/sentry"
import { createLogger } from "../lib/logger"

const logger = createLogger("subscriber:order-placed-fill-customer")

const PHONE_BRIDGE_EMAIL_RE = /@phone\.suprameds\.in$/i

/**
 * Back-fill empty customer profile fields from the order's shipping address.
 *
 * Why: OTP-only signups create a customer with just `phone` set — no name,
 * no real email. When that customer places their first order, the address
 * step already captures first_name + last_name (Medusa makes them required
 * for shipping). We copy those into the customer record so the account UI
 * stops showing blank "First name" / "Last name", and any code that templates
 * with `customer.first_name` (emails, cash memos, courier AWB, pharmacist
 * verification UI) has something to show.
 *
 * Email is back-filled only when the current value is the auto-generated
 * `{phone}@phone.suprameds.in` placeholder — we never overwrite a real email
 * the user has set deliberately via /store/profile/email.
 *
 * Idempotent: if the customer already has these fields, this is a no-op.
 * Non-fatal: any failure is logged + reported to Sentry, never propagates
 * (an order placement must not fail because the back-fill couldn't happen).
 */
export default async function orderPlacedFillCustomerHandler({
  event: { data },
  container,
}: SubscriberArgs<{ id: string }>) {
  const orderId = data.id
  if (!orderId) return

  try {
    const orderService = container.resolve(Modules.ORDER) as any
    const customerService = container.resolve(Modules.CUSTOMER) as any

    const order = await orderService.retrieveOrder(orderId, {
      relations: ["shipping_address"],
    })

    const customerId: string | undefined = order?.customer_id
    if (!customerId) {
      logger.debug(`Order ${orderId} has no customer_id (guest order) — skipping back-fill`)
      return
    }

    const ship = order.shipping_address
    if (!ship) {
      logger.debug(`Order ${orderId} has no shipping_address — skipping back-fill`)
      return
    }

    const customer = await customerService.retrieveCustomer(customerId)
    if (!customer) return

    const patch: Record<string, string> = {}

    // first_name / last_name — only fill if empty/null/whitespace
    const currentFirst = (customer.first_name ?? "").trim()
    const currentLast = (customer.last_name ?? "").trim()
    const shipFirst = (ship.first_name ?? "").trim()
    const shipLast = (ship.last_name ?? "").trim()

    if (!currentFirst && shipFirst) patch.first_name = shipFirst
    if (!currentLast && shipLast) patch.last_name = shipLast

    // email — only replace the phone-bridge placeholder, never a real email
    const currentEmail = (customer.email ?? "").trim()
    const shipEmail = (ship.email ?? "").trim().toLowerCase()
    const currentIsPlaceholder = !!currentEmail && PHONE_BRIDGE_EMAIL_RE.test(currentEmail)
    const shipIsPlaceholder = !!shipEmail && PHONE_BRIDGE_EMAIL_RE.test(shipEmail)

    if (currentIsPlaceholder && shipEmail && !shipIsPlaceholder) {
      patch.email = shipEmail
    }

    if (Object.keys(patch).length === 0) {
      logger.debug(`Customer ${customerId} already has all back-fillable fields — skipping`)
      return
    }

    await customerService.updateCustomers({ id: customerId, ...patch })

    logger.info(
      `Back-filled customer ${customerId} from order ${orderId}: ${Object.keys(patch).join(", ")}`,
    )
  } catch (err) {
    // Never let back-fill failures bubble up — the order is already placed.
    logger.error(`Failed to back-fill customer from order ${orderId}: ${(err as Error).message}`)
    captureException(err, { tags: { subscriber: "order-placed-fill-customer", order_id: orderId } })
  }
}

export const config: SubscriberConfig = { event: "order.placed" }
