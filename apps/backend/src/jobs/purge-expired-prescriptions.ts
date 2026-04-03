import { MedusaContainer } from "@medusajs/framework/types"
import { jobGuard } from "../lib/job-guard"
import { PRESCRIPTION_MODULE } from "../modules/prescription"

const LOG = "[job:purge-prescriptions]"

/**
 * Daily job — marks prescriptions older than 6 months as expired.
 * Indian Rx validity is typically 6 months from issue date.
 * Runs at 01:00 UTC daily.
 */
export default async function PurgeExpiredPrescriptionsJob(container: MedusaContainer) {
  const guard = jobGuard("purge-prescriptions")
  if (guard.shouldSkip()) return

  const logger = container.resolve("logger") as any
  logger.info(`${LOG} Starting`)

  try {
    const prescriptionService = container.resolve(PRESCRIPTION_MODULE) as any

    // Fetch pending/approved prescriptions that are past expiry (6 months)
    const sixMonthsAgo = new Date()
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6)

    const expiredRx = await prescriptionService.listPrescriptions(
      {
        status: ["pending_review", "approved"],
        created_at: { $lt: sixMonthsAgo.toISOString() },
      },
      { take: 500 }
    )

    if (!expiredRx?.length) {
      logger.info(`${LOG} No expired prescriptions found`)
      return
    }

    let count = 0
    for (const rx of expiredRx) {
      try {
        await prescriptionService.updatePrescriptions({
          id: rx.id,
          status: "expired",
        })
        count++
      } catch (err) {
        logger.warn(`${LOG} Failed to expire Rx ${rx.id}: ${(err as Error).message}`)
      }
    }

    logger.info(`${LOG} Expired ${count}/${expiredRx.length} prescriptions`)
    guard.success()
  } catch (err) {
    guard.failure(err)
    logger.error(`${LOG} Failed: ${(err as Error).message}`)
  }
}

export const config = {
  name: "purge-prescriptions",
  schedule: "15 1 * * *", // was: 0 1 * * * — staggered to avoid pool exhaustion
}
