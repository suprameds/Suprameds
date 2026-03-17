import { MedusaContainer } from "@medusajs/framework/types"

export default async function UpdateDeliveryDaysJob(container: MedusaContainer) {
  const logger = container.resolve("logger")
  logger.info("[job] Executing update-delivery-days")
  // TODO: Implement job logic
}

export const config = {
  name: "update-delivery-days",
  schedule: "0 2 * * 0",
}
