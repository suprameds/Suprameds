import type { SubscriberArgs, SubscriberConfig } from "@medusajs/framework"

export default async function handler({ event }: SubscriberArgs<Record<string, unknown>>) {
  console.info("[subscriber] order.dispatched", event.data)
  // TODO: Implement subscriber logic
}

export const config: SubscriberConfig = { event: "order.dispatched" }
