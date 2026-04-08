import type { SubscriberArgs, SubscriberConfig } from "@medusajs/framework"
import { sendPushToCustomerTopic } from "../lib/firebase-messaging"
import { captureException } from "../lib/sentry"
import { createLogger } from "../lib/logger"

const logger = createLogger("subscriber:loyalty-points-earned")

type PointsEarnedData = {
  customer_id: string
  order_id: string
  points: number
  new_tier: string
  previous_tier: string
}

/**
 * Sends a push notification when a customer earns loyalty points.
 * Includes a tier upgrade message if tier changed.
 */
export default async function loyaltyPointsEarnedHandler({
  event: { data },
}: SubscriberArgs<PointsEarnedData>) {
  const { customer_id, points, new_tier, previous_tier, order_id } = data
  logger.info(`Customer ${customer_id} earned ${points} points from order ${order_id}`)

  if (!customer_id || !points || points <= 0) return

  try {
    let body = `You earned ${points} Suprameds reward points! 🎉`
    if (new_tier !== previous_tier) {
      body += ` Congratulations — you've been upgraded to ${new_tier.charAt(0).toUpperCase() + new_tier.slice(1)} tier!`
    }

    const result = await sendPushToCustomerTopic(customer_id, {
      title: "Points Earned!",
      body,
      data: {
        type: "loyalty_earned",
        order_id: order_id ?? "",
        points: String(points),
        url: "/account/loyalty",
      },
    })

    if (!result.ok) {
      logger.warn(`Push not sent: ${result.reason}`)
    }
  } catch (error) {
    // Push notification failure must NOT break the flow
    logger.error(`Failed to send push:`, (error as Error).message)
    captureException(error, { subscriber: "loyalty-points-earned", customerId: customer_id, orderId: order_id })
  }
}

export const config: SubscriberConfig = { event: "loyalty.points_earned" }
