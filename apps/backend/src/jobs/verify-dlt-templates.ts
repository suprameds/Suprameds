import { MedusaContainer } from "@medusajs/framework/types"
import { NOTIFICATION_MODULE } from "../modules/notification"

/**
 * Verify DLT Templates — daily compliance job.
 *
 * TRAI (Telecom Regulatory Authority of India) mandates that every SMS
 * sent in India must use a DLT-registered template. Unregistered templates
 * result in message blocking and potential carrier penalties.
 *
 * This job:
 *   1. Checks that every required SMS template has its MSG91 template ID
 *      configured via environment variables.
 *   2. Logs warnings for any missing templates.
 *   3. Creates internal compliance_failure notifications so the admin
 *      dashboard surfaces the gap prominently.
 *
 * Runs daily at 02:00 IST to catch configuration drift after deployments.
 */

interface RequiredTemplate {
  /** Human-readable template purpose */
  name: string
  /** Expected env var name holding the MSG91 template ID */
  envVar: string
  /** Whether this template is legally required (vs. nice-to-have) */
  mandatory: boolean
}

const REQUIRED_DLT_TEMPLATES: RequiredTemplate[] = [
  {
    name: "OTP Verification",
    envVar: "MSG91_TEMPLATE_ID_OTP",
    mandatory: true,
  },
  {
    name: "Order Placed Confirmation",
    envVar: "MSG91_TEMPLATE_ID_ORDER_PLACED",
    mandatory: true,
  },
  {
    name: "Order Shipped Notification",
    envVar: "MSG91_TEMPLATE_ID_ORDER_SHIPPED",
    mandatory: true,
  },
  {
    name: "Order Delivered Confirmation",
    envVar: "MSG91_TEMPLATE_ID_ORDER_DELIVERED",
    mandatory: true,
  },
  {
    name: "Prescription Approved",
    envVar: "MSG91_TEMPLATE_ID_RX_APPROVED",
    mandatory: true,
  },
  {
    name: "Prescription Rejected",
    envVar: "MSG91_TEMPLATE_ID_RX_REJECTED",
    mandatory: true,
  },
  {
    name: "Payment Failed",
    envVar: "MSG91_TEMPLATE_ID_PAYMENT_FAILED",
    mandatory: true,
  },
  {
    name: "COD Confirmation Reminder",
    envVar: "MSG91_TEMPLATE_ID_COD_CONFIRM",
    mandatory: false,
  },
  {
    name: "Refill Reminder",
    envVar: "MSG91_TEMPLATE_ID_REFILL_REMINDER",
    mandatory: false,
  },
  {
    name: "Abandoned Cart Nudge",
    envVar: "MSG91_TEMPLATE_ID_ABANDONED_CART",
    mandatory: false,
  },
]

export default async function VerifyDltTemplatesJob(container: MedusaContainer) {
  const logger = container.resolve("logger")
  logger.info("[verify-dlt] Starting DLT template compliance check")

  const missingMandatory: RequiredTemplate[] = []
  const missingOptional: RequiredTemplate[] = []

  for (const tpl of REQUIRED_DLT_TEMPLATES) {
    const value = process.env[tpl.envVar]?.trim()

    if (!value) {
      if (tpl.mandatory) {
        missingMandatory.push(tpl)
        logger.error(
          `[verify-dlt] MISSING MANDATORY DLT template: ${tpl.name} (env: ${tpl.envVar})`
        )
      } else {
        missingOptional.push(tpl)
        logger.warn(
          `[verify-dlt] Missing optional DLT template: ${tpl.name} (env: ${tpl.envVar})`
        )
      }
    } else {
      logger.info(`[verify-dlt] ✓ ${tpl.name} — template ID configured`)
    }
  }

  // Create internal notifications for missing mandatory templates
  if (missingMandatory.length > 0) {
    try {
      const notificationService = container.resolve(NOTIFICATION_MODULE) as any

      const templateList = missingMandatory
        .map((t) => `• ${t.name} (${t.envVar})`)
        .join("\n")

      await notificationService.createInternalNotifications({
        // Broadcast to all admin users — use a system user ID
        user_id: "system",
        role_scope: "admin",
        type: "compliance_failure",
        title: `DLT Compliance: ${missingMandatory.length} mandatory SMS template(s) missing`,
        body:
          `TRAI DLT compliance check failed. The following mandatory SMS templates ` +
          `do not have a registered MSG91 template ID configured:\n\n${templateList}\n\n` +
          `SMS messages using these templates will be BLOCKED by carriers. ` +
          `Please register templates on the DLT portal and add the template IDs ` +
          `to the environment configuration immediately.`,
        reference_type: "dlt_compliance",
        reference_id: new Date().toISOString().slice(0, 10),
      })

      logger.warn(
        `[verify-dlt] Created compliance_failure notification for ${missingMandatory.length} missing template(s)`
      )
    } catch (error) {
      logger.error("[verify-dlt] Failed to create internal notification:", error)
    }
  }

  // Log summary for optional templates (no notification, just warning)
  if (missingOptional.length > 0) {
    logger.warn(
      `[verify-dlt] ${missingOptional.length} optional DLT template(s) not configured: ` +
        missingOptional.map((t) => t.name).join(", ")
    )
  }

  const total = REQUIRED_DLT_TEMPLATES.length
  const configured = total - missingMandatory.length - missingOptional.length

  logger.info(
    `[verify-dlt] Completed — ${configured}/${total} templates configured, ` +
      `${missingMandatory.length} mandatory missing, ${missingOptional.length} optional missing`
  )
}

export const config = {
  name: "verify-dlt",
  // Run daily at 2:00 AM IST (20:30 UTC previous day)
  schedule: "30 20 * * *",
}
