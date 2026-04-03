import { MedusaContainer } from "@medusajs/framework/types"

export default async function GenerateH1ReportJob(
  container: MedusaContainer
) {
  const logger = container.resolve("logger")
  const complianceService = container.resolve("pharmaCompliance") as any
  const notificationService = container.resolve("pharmaNotification") as any

  logger.info("[h1-report] Starting daily H1 register report generation")

  try {
    // Yesterday midnight-to-midnight in local server time
    const now = new Date()
    const yesterdayStart = new Date(now)
    yesterdayStart.setDate(now.getDate() - 1)
    yesterdayStart.setHours(0, 0, 0, 0)

    const yesterdayEnd = new Date(now)
    yesterdayEnd.setDate(now.getDate() - 1)
    yesterdayEnd.setHours(23, 59, 59, 999)

    const dateLabel = yesterdayStart.toISOString().slice(0, 10)

    const entries = await complianceService.listH1RegisterEntries(
      {
        created_at: {
          $gte: yesterdayStart.toISOString(),
          $lte: yesterdayEnd.toISOString(),
        },
      },
      { take: null }
    )

    if (!entries || entries.length === 0) {
      logger.info(`[h1-report] No H1 register entries for ${dateLabel}`)
      return
    }

    // Build report table
    const separator = "=".repeat(60)
    const header = [
      "",
      `H1 REGISTER REPORT — ${dateLabel}`,
      separator,
      `Total Entries: ${entries.length}`,
      "",
      "| # | Date | Patient | Prescriber | Drug | Batch | Qty | Pharmacist |",
      "|---|------|---------|------------|------|-------|-----|------------|",
    ]

    const rows = entries.map((entry: any, idx: number) => {
      const entryDate = new Date(entry.entry_date).toISOString().slice(0, 10)
      return `| ${idx + 1} | ${entryDate} | ${entry.patient_name} | ${entry.prescriber_name} | ${entry.drug_name} | ${entry.batch_number} | ${entry.quantity_dispensed} | ${entry.dispensing_pharmacist} |`
    })

    const report = [...header, ...rows, ""].join("\n")
    logger.info(report)

    // Create internal notification for visibility
    try {
      await notificationService.createInternalNotifications({
        user_id: "system",
        role_scope: "pharmacist",
        type: "dispatch_pending",
        title: `H1 Register Report — ${dateLabel}`,
        body: `${entries.length} Schedule H1 dispense entries recorded on ${dateLabel}. Review and file per CDSCO requirements.`,
        reference_type: "h1_report",
        reference_id: dateLabel,
      })
    } catch (notifErr) {
      logger.error(
        `[h1-report] Failed to create report notification: ${notifErr}`
      )
    }

    logger.info(
      `[h1-report] Report complete: ${entries.length} entries for ${dateLabel}`
    )
  } catch (err) {
    logger.error(`[h1-report] Job failed: ${err}`)
    throw err
  }
}

export const config = {
  name: "generate-h1",
  schedule: "10 0 * * *", // was: 0 0 * * * — staggered to avoid pool exhaustion
}
