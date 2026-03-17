import { MedusaContainer } from "@medusajs/framework/types"

export default async function PurgeExpiredPrescriptionsJob(container: MedusaContainer) {
  const logger = container.resolve("logger")
  logger.info("[job] Executing purge-prescriptions")
  // TODO: Implement job logic
}

export const config = {
  name: "purge-prescriptions",
  schedule: "0 1 * * *",
}
