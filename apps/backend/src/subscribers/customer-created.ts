import type { SubscriberArgs, SubscriberConfig } from "@medusajs/framework"

export default async function handler({ event }: SubscriberArgs<Record<string, unknown>>) {
  console.info("[subscriber] customer.created", event.data)
  // TODO: Implement subscriber logic
}

export const config: SubscriberConfig = { event: "customer.created" }
