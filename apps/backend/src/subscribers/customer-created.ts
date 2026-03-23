import type { SubscriberArgs, SubscriberConfig } from "@medusajs/framework"
import { Modules } from "@medusajs/framework/utils"

const LOG = "[subscriber:customer-created]"

/**
 * Fires when a new customer registers on the storefront.
 * Sends a welcome email and logs the event for analytics.
 */
export default async function customerCreatedHandler({
  event: { data },
  container,
}: SubscriberArgs<{ id: string }>) {
  const customerId = data.id
  if (!customerId) return

  console.info(`${LOG} New customer: ${customerId}`)

  try {
    const customerService = container.resolve(Modules.CUSTOMER) as any
    const customer = await customerService.retrieveCustomer(customerId)

    if (!customer?.email) {
      console.warn(`${LOG} Customer ${customerId} has no email — skipping welcome`)
      return
    }

    // Send welcome email
    try {
      const notificationService = container.resolve("notification") as any
      await notificationService.createNotifications({
        to: customer.email,
        channel: "email",
        template: "welcome",
        data: {
          first_name: customer.first_name || "",
          email: customer.email,
        },
      })
      console.info(`${LOG} Welcome email queued for ${customer.email}`)
    } catch (err) {
      console.warn(
        `${LOG} Welcome email failed for ${customer.email}: ${(err as Error).message}`
      )
    }
  } catch (err) {
    console.error(`${LOG} Failed for customer ${customerId}: ${(err as Error).message}`)
  }
}

export const config: SubscriberConfig = { event: "customer.created" }
