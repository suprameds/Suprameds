import { MedusaContainer } from "@medusajs/framework/types"

export default async function SyncAftershipStatusJob(container: MedusaContainer) {
  const logger = container.resolve("logger")
  logger.info("[job] Executing sync-aftership")
  // TODO: Implement job logic
}

export const config = {
  name: "sync-aftership",
  schedule: "*/30 * * * *",
}
