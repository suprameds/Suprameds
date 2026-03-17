import { MedusaContainer } from "@medusajs/framework/types"

export default async function ClearPhiAuditLogsJob(container: MedusaContainer) {
  const logger = container.resolve("logger")
  logger.info("[job] Executing clear-phi-logs")
  // TODO: Implement job logic
}

export const config = {
  name: "clear-phi-logs",
  schedule: "0 0 * * *",
}
