import type { SubscriberArgs, SubscriberConfig } from "@medusajs/framework"
import { sendPushToCustomerTopic } from "../lib/firebase-messaging"

const LOG_PREFIX = "[subscriber:loyalty-earned]"

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
export default async function handler({
  event: { data },
}: SubscriberArgs<PointsEarnedData>) {
  const { customer_id, points, new_tier, previous_tier, order_id } = data
  console.info(`${LOG_PREFIX} Customer ${customer_id} earned ${points} points from order ${order_id}`)

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
      console.warn(`${LOG_PREFIX} Push not sent: ${result.reason}`)
    }
  } catch (error) {
    // Push notification failure must NOT break the flow
    console.error(`${LOG_PREFIX} Failed to send push:`, (error as Error).message)
  }
}

export const config: SubscriberConfig = { event: "loyalty.points_earned" }
