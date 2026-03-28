import type { SubscriberArgs, SubscriberConfig } from "@medusajs/framework"
import { NOTIFICATION_MODULE } from "../modules/notification"
import { captureException } from "../lib/sentry"
import { createLogger } from "../lib/logger"

const logger = createLogger("subscriber:h1-register-updated")

type H1RegisterData = {
  entry_id?: string
  order_id?: string
  pharmacist_id?: string
  drug_name?: string
  patient_name?: string
  quantity_dispensed?: number
}

/**
 * Fires when a new H1 register entry is created (Schedule H1 drug dispensed).
 * Creates an audit trail notification for compliance officers and logs the
 * dispensing event for regulatory records.
 */
export default async function h1RegisterUpdatedHandler({
  event: { data },
  container,
}: SubscriberArgs<H1RegisterData>) {
  const entryId = data.entry_id
  logger.info(
    `H1 register entry ${entryId ?? "unknown"} — ` +
      `drug: ${data.drug_name ?? "n/a"}, qty: ${data.quantity_dispensed ?? "n/a"}, ` +
      `pharmacist: ${data.pharmacist_id ?? "unknown"}`
  )

  try {
    const notifService = container.resolve(NOTIFICATION_MODULE) as any

    await notifService.createInternalNotifications({
      user_id: data.pharmacist_id ?? "system",
      role_scope: "compliance_officer",
      type: "h1_register_entry",
      title: `H1 Register — ${data.drug_name ?? "Schedule H1 drug"} dispensed`,
      body:
        `Qty: ${data.quantity_dispensed ?? "—"}, ` +
        `Patient: ${data.patient_name ? "" : "n/a"}, ` +
        `Order: ${data.order_id ?? "n/a"}, ` +
        `Pharmacist: ${data.pharmacist_id ?? "unknown"}`,
      reference_type: "h1_register_entry",
      reference_id: entryId ?? data.order_id ?? "unknown",
    })

    logger.info(`Compliance notification created for entry ${entryId}`)
  } catch (err) {
    logger.error(`Failed: ${(err as Error).message}`)
    captureException(err, { subscriber: "h1-register-updated", entryId, orderId: data.order_id })
  }
}

export const config: SubscriberConfig = { event: "h1.register_updated" }
