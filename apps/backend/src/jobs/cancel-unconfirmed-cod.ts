import { MedusaContainer } from "@medusajs/framework/types"

export default async function CancelUnconfirmedCodJob(container: MedusaContainer) {
  const logger = container.resolve("logger")
  logger.info("[job] Executing cancel-cod")
  // TODO: Implement job logic
}

export const config = {
  name: "cancel-cod",
  schedule: "*/15 * * * *",
}
