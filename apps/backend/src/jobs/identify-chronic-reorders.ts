import { MedusaContainer } from "@medusajs/framework/types"

export default async function IdentifyChronicReordersJob(container: MedusaContainer) {
  const logger = container.resolve("logger")
  logger.info("[job] Executing identify-reorders")
  // TODO: Implement job logic
}

export const config = {
  name: "identify-reorders",
  schedule: "0 3 * * *",
}
