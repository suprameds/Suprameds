import type { SubscriberArgs, SubscriberConfig } from "@medusajs/framework"
import { Modules } from "@medusajs/framework/utils"
import { captureException } from "../lib/sentry"
import { createLogger } from "../lib/logger"

const logger = createLogger("subscriber:customer-created")

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

  logger.info(`New customer: ${customerId}`)

  try {
    const customerService = container.resolve(Modules.CUSTOMER) as any
    const customer = await customerService.retrieveCustomer(customerId)

    if (!customer?.email) {
      logger.warn(`Customer ${customerId} has no email — skipping welcome`)
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
      logger.info(`Welcome email queued for ${customer.email}`)
    } catch (err) {
      logger.warn(
        `Welcome email failed for ${customer.email}: ${(err as Error).message}`
      )
      captureException(err, { subscriber: "customer-created", customerId, step: "send-welcome-email" })
    }
  } catch (err) {
    logger.error(`Failed for customer ${customerId}: ${(err as Error).message}`)
    captureException(err, { subscriber: "customer-created", customerId })
  }
}

export const config: SubscriberConfig = { event: "customer.created" }
