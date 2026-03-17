import { MedusaContainer } from "@medusajs/framework/types"

export default async function GenerateH1ReportJob(container: MedusaContainer) {
  const logger = container.resolve("logger")
  logger.info("[job] Executing generate-h1")
  // TODO: Implement job logic
}

export const config = {
  name: "generate-h1",
  schedule: "0 0 * * *",
}
