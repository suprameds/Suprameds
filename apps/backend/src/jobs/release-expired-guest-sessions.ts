import { MedusaContainer } from "@medusajs/framework/types"

export default async function ReleaseExpiredGuestSessionsJob(container: MedusaContainer) {
  const logger = container.resolve("logger")
  logger.info("[job] Executing release-guest-sessions")
  // TODO: Implement job logic
}

export const config = {
  name: "release-guest-sessions",
  schedule: "0 2 * * *",
}
