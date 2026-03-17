import { MedusaContainer } from "@medusajs/framework/types"

export default async function SendChronicRefillRemindersJob(container: MedusaContainer) {
  const logger = container.resolve("logger")
  logger.info("[job] Executing chronic-reminders")
  // TODO: Implement job logic
}

export const config = {
  name: "chronic-reminders",
  schedule: "0 9 * * *",
}
