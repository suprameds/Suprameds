import type { SubscriberArgs, SubscriberConfig } from "@medusajs/framework"
import { createLogger } from "../lib/logger"

const logger = createLogger("subscriber:prescription-expired")

/** Fires when Rx expires. TODO: Notify customer, block reorders. */
export default async function prescriptionExpiredHandler({ event }: SubscriberArgs<Record<string, unknown>>) {
  logger.info("prescription.expired", event.data)
}

export const config: SubscriberConfig = { event: "prescription.expired" }
