import { MedusaContainer } from "@medusajs/framework/types"

export default async function ExpireLoyaltyPointsJob(container: MedusaContainer) {
  const logger = container.resolve("logger")
  logger.info("[job] Executing expire-loyalty")
  // TODO: Implement job logic
}

export const config = {
  name: "expire-loyalty",
  schedule: "0 4 * * *",
}
