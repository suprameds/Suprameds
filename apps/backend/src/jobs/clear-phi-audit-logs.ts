import { MedusaContainer } from "@medusajs/framework/types"
import { jobGuard } from "../lib/job-guard"
import { COMPLIANCE_MODULE } from "../modules/compliance"

const LOG = "[job:clear-phi-logs]"

/**
 * Daily job — purges PHI audit logs older than the retention period.
 * DPDP Act 2023 requires data minimization: personal health information
 * access logs are retained for 90 days (configurable via env), then deleted.
 * Runs at midnight UTC daily.
 */
export default async function ClearPhiAuditLogsJob(container: MedusaContainer) {
  const guard = jobGuard("clear-phi-logs")
  if (guard.shouldSkip()) return

  const logger = container.resolve("logger") as any
  logger.info(`${LOG} Starting`)

  const retentionDays = Number(process.env.PHI_AUDIT_RETENTION_DAYS) || 90

  try {
    const complianceService = container.resolve(COMPLIANCE_MODULE) as any

    const cutoffDate = new Date()
    cutoffDate.setDate(cutoffDate.getDate() - retentionDays)

    const oldLogs = await complianceService.listPhiAuditLogs(
      { created_at: { $lt: cutoffDate.toISOString() } },
      { take: 1000, select: ["id"] }
    )

    if (!oldLogs?.length) {
      logger.info(`${LOG} No PHI audit logs older than ${retentionDays} days`)
      return
    }

    let deleted = 0
    for (const log of oldLogs) {
      try {
        await complianceService.deletePhiAuditLogs(log.id)
        deleted++
      } catch (err) {
        logger.warn(`${LOG} Failed to delete log ${log.id}: ${(err as Error).message}`)
      }
    }

    logger.info(`${LOG} Purged ${deleted}/${oldLogs.length} PHI audit logs (retention: ${retentionDays}d)`)
    guard.success()
  } catch (err) {
    guard.failure(err)
    logger.error(`${LOG} Failed: ${(err as Error).message}`)
  }
}

export const config = {
  name: "clear-phi-logs",
  schedule: "5 0 * * *", // was: 0 0 * * * — staggered to avoid pool exhaustion
}
