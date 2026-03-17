import { MedusaContainer } from "@medusajs/framework/types"

export default async function FlagNearExpiryBatchesJob(container: MedusaContainer) {
  const logger = container.resolve("logger")
  logger.info("[job] Executing flag-expiry")
  // TODO: Implement job logic
}

export const config = {
  name: "flag-expiry",
  schedule: "0 5 * * 1",
}
