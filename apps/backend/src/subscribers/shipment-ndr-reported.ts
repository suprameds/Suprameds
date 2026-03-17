import type { SubscriberArgs, SubscriberConfig } from "@medusajs/framework"

export default async function handler({ event }: SubscriberArgs<Record<string, unknown>>) {
  console.info("[subscriber] shipment.ndr_reported", event.data)
  // TODO: Implement subscriber logic
}

export const config: SubscriberConfig = { event: "shipment.ndr_reported" }
