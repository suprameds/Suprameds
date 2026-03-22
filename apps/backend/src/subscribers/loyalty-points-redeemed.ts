import type { SubscriberArgs, SubscriberConfig } from "@medusajs/framework"
import { sendPushToCustomerTopic } from "../lib/firebase-messaging"

const LOG_PREFIX = "[subscriber:loyalty-redeemed]"

type PointsRedeemedData = {
  customer_id: string
  points: number
  remaining_balance: number
  order_id?: string
}

/**
 * Sends a push notification when a customer redeems loyalty points.
 */
export default async function handler({
  event: { data },
}: SubscriberArgs<PointsRedeemedData>) {
  const { customer_id, points, remaining_balance } = data
  console.info(`${LOG_PREFIX} Customer ${customer_id} redeemed ${points} points`)

  if (!customer_id || !points || points <= 0) return

  try {
    const result = await sendPushToCustomerTopic(customer_id, {
      title: "Points Redeemed",
      body: `You redeemed ${points} points on your order. Remaining balance: ${remaining_balance ?? 0} points.`,
      data: {
        type: "loyalty_redeemed",
        order_id: data.order_id ?? "",
        points: String(points),
        url: "/account/loyalty",
      },
    })

    if (!result.ok) {
      console.warn(`${LOG_PREFIX} Push not sent: ${result.reason}`)
    }
  } catch (error) {
    console.error(`${LOG_PREFIX} Failed to send push:`, (error as Error).message)
  }
}

export const config: SubscriberConfig = { event: "loyalty.points_redeemed" }
