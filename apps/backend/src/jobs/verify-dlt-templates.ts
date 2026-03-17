import { MedusaContainer } from "@medusajs/framework/types"

export default async function VerifyDltTemplatesJob(container: MedusaContainer) {
  const logger = container.resolve("logger")
  logger.info("[job] Executing verify-dlt")
  // TODO: Implement job logic
}

export const config = {
  name: "verify-dlt",
  schedule: "0 8 * * *",
}
