import type { SubscriberArgs, SubscriberConfig } from "@medusajs/framework"

export default async function handler({ event }: SubscriberArgs<Record<string, unknown>>) {
  console.info("[subscriber] inventory.low_stock", event.data)
  // TODO: Implement subscriber logic
}

export const config: SubscriberConfig = { event: "inventory.low_stock" }
