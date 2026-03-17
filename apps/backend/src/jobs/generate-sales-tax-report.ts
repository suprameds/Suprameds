import { MedusaContainer } from "@medusajs/framework/types"

export default async function GenerateSalesTaxReportJob(container: MedusaContainer) {
  const logger = container.resolve("logger")
  logger.info("[job] Executing sales-tax")
  // TODO: Implement job logic
}

export const config = {
  name: "sales-tax",
  schedule: "0 6 1 * *",
}
