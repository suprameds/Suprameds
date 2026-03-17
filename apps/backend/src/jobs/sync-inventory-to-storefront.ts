import { MedusaContainer } from "@medusajs/framework/types"

export default async function SyncInventoryToStorefrontJob(container: MedusaContainer) {
  const logger = container.resolve("logger")
  logger.info("[job] Executing sync-inventory")
  // TODO: Implement job logic
}

export const config = {
  name: "sync-inventory",
  schedule: "*/5 * * * *",
}
