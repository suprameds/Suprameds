import { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { CRM_MODULE } from "../modules/crm"
import { PHARMA_MODULE } from "../modules/pharma"
import { sendPushToCustomerTopic } from "../lib/firebase-messaging"
import { jobGuard } from "../lib/job-guard"

const LOG_PREFIX = "[job:chronic-reminders]"

/**
 * Runs every 6 hours: sends push notifications for chronic refill reminders.
 *
 * Compliance:
 * - DO NOT include specific drug names for Schedule H/H1 in push notifications.
 * - Use "your prescription medicine" instead.
 */
export default async function SendChronicRefillRemindersJob(container: MedusaContainer) {
  const logger = container.resolve("logger") as any

  const hasFirebase = Boolean(
    process.env.FIREBASE_PROJECT_ID &&
    process.env.FIREBASE_CLIENT_EMAIL &&
    process.env.FIREBASE_PRIVATE_KEY
  )
  if (!hasFirebase) {
    logger.info(`${LOG_PREFIX} Firebase not configured — skipping chronic refill reminders`)
    return
  }

  const guard = jobGuard("chronic-reminders")
  if (guard.shouldSkip()) return

  const query = container.resolve(ContainerRegistrationKeys.QUERY) as any
  const crmService = container.resolve(CRM_MODULE) as any
  const pharmaService = container.resolve(PHARMA_MODULE) as any

  logger.info(`${LOG_PREFIX} Starting chronic refill reminder scan`)

  let sentCount = 0
  let skippedCount = 0

  try {
    const now = new Date()

    // Find active patterns where reminder is due
    const patterns = await crmService.listChronicReorderPatterns(
      { is_active: true },
      { take: null }
    )

    const duePatterns = patterns.filter((p: any) => {
      const nextExpected = new Date(p.next_expected_at)
      return nextExpected <= now
    })

    if (!duePatterns.length) {
      logger.info(`${LOG_PREFIX} No reminders due — skipping`)
      return
    }

    logger.info(`${LOG_PREFIX} Found ${duePatterns.length} due reminders`)

    for (const pattern of duePatterns) {
      try {
        // Look up the product variant to get the product_id
        const { data: variants } = await query.graph({
          entity: "product_variant",
          fields: ["id", "product_id", "title"],
          filters: { id: pattern.variant_id },
        })

        const variant = variants?.[0]
        if (!variant) {
          logger.warn(`${LOG_PREFIX} Variant ${pattern.variant_id} not found — skipping`)
          skippedCount++
          continue
        }

        // Look up drug schedule for compliance check
        let displayName = variant.title || "your medicine"
        let isRx = false

        if (variant.product_id) {
          const [drug] = await pharmaService.listDrugProducts({
            product_id: variant.product_id,
          })
          if (drug) {
            isRx = drug.schedule === "H" || drug.schedule === "H1"
            // For OTC drugs, use generic_name; for Rx drugs, use generic label per compliance
            displayName = isRx
              ? "your prescription medicine"
              : (drug.generic_name || variant.title || "your medicine")
          }
        }

        const result = await sendPushToCustomerTopic(pattern.customer_id, {
          title: "Time for a Refill?",
          body: `Time to refill ${displayName}? Reorder now on Suprameds and save!`,
          data: {
            type: "chronic_refill",
            variant_id: pattern.variant_id,
            url: "/account/orders",
          },
        })

        if (!result.ok) {
          logger.warn(`${LOG_PREFIX} Push not sent for ${pattern.customer_id}: ${result.reason}`)
          skippedCount++
        } else {
          sentCount++
        }

        // Advance next_expected_at for the next cycle regardless of push outcome
        const nextReminder = new Date(
          now.getTime() + pattern.average_days_between_orders * 24 * 60 * 60 * 1000
        )

        await crmService.updateChronicReorderPatterns(pattern.id, {
          reminder_sent_at: now,
          next_expected_at: nextReminder,
        })
      } catch (err) {
        logger.error(
          `${LOG_PREFIX} Failed to process pattern ${pattern.id}: ${(err as Error).message}`
        )
        skippedCount++
      }
    }

    logger.info(
      `${LOG_PREFIX} Completed: ${sentCount} reminders sent, ${skippedCount} skipped`
    )
    guard.success()
  } catch (err) {
    guard.failure(err)
    logger.error(`${LOG_PREFIX} Job failed: ${err}`)
    throw err
  }
}

export const config = {
  name: "chronic-reminders",
  schedule: "41 */6 * * *", // was: 0 */6 * * * — staggered to avoid pool exhaustion
}
