import type { SubscriberArgs, SubscriberConfig } from "@medusajs/framework"

/** Fires when some Rx lines approved/rejected. TODO: Recalculate totals, release partial payment. */
export default async function handler({ event }: SubscriberArgs<Record<string, unknown>>) {
  console.info("[subscriber] prescription.partially_approved", event.data)
}

export const config: SubscriberConfig = { event: "prescription.partially_approved" }
