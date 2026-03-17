import { MedusaContainer } from "@medusajs/framework/types"

export default async function AutoAllocateFefoJob(container: MedusaContainer) {
  const logger = container.resolve("logger")
  logger.info("[job] Executing auto-allocate-fefo")
  // TODO: Implement job logic
}

export const config = {
  name: "auto-allocate-fefo",
  schedule: "*/5 * * * *",
}
