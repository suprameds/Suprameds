import type { SubscriberArgs, SubscriberConfig } from "@medusajs/framework"
import { createLogger } from "../lib/logger"

const logger = createLogger("subscriber:prescription-partially-approved")

/** Fires when some Rx lines approved/rejected. TODO: Recalculate totals, release partial payment. */
export default async function prescriptionPartiallyApprovedHandler({ event }: SubscriberArgs<Record<string, unknown>>) {
  logger.info("prescription.partially_approved", event.data)
}

export const config: SubscriberConfig = { event: "prescription.partially_approved" }
