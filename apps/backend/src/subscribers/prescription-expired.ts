import type { SubscriberArgs, SubscriberConfig } from "@medusajs/framework"

/** Fires when Rx expires. TODO: Notify customer, block reorders. */
export default async function handler({ event }: SubscriberArgs<Record<string, unknown>>) {
  console.info("[subscriber] prescription.expired", event.data)
}

export const config: SubscriberConfig = { event: "prescription.expired" }
