import type { SubscriberArgs, SubscriberConfig } from "@medusajs/framework"

export default async function handler({ event }: SubscriberArgs<Record<string, unknown>>) {
  console.info("[subscriber] loyalty.points_redeemed", event.data)
  // TODO: Implement subscriber logic
}

export const config: SubscriberConfig = { event: "loyalty.points_redeemed" }
