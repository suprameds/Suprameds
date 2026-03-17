import { MedusaContainer } from "@medusajs/framework/types"

export default async function RemindAbandonedCartsJob(container: MedusaContainer) {
  const logger = container.resolve("logger")
  logger.info("[job] Executing remind-carts")
  // TODO: Implement job logic
}

export const config = {
  name: "remind-carts",
  schedule: "0 * * * *",
}
