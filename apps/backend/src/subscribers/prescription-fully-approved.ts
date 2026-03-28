import type { SubscriberArgs, SubscriberConfig } from "@medusajs/framework"
import { INotificationModuleService } from "@medusajs/framework/types"
import { Modules } from "@medusajs/framework/utils"
import { PRESCRIPTION_MODULE } from "../modules/prescription"
import { sendPushToCustomerTopic } from "../lib/firebase-messaging"
import { captureException } from "../lib/sentry"
import { createLogger } from "../lib/logger"

const logger = createLogger("subscriber:prescription-fully-approved")

/** Fires when all Rx lines approved. SMS T05. */
export default async function prescriptionFullyApprovedHandler({
  event: { data },
  container,
}: SubscriberArgs<{ id: string }>) {
  const notificationModuleService: INotificationModuleService = container.resolve(
    Modules.NOTIFICATION
  )
  const prescriptionModule: any = container.resolve(PRESCRIPTION_MODULE)
  const [prescription] = await prescriptionModule.listPrescriptions({ id: data.id })

  // Send SMS to customer (T05_RX_APPROVED) — gracefully skip if no SMS provider configured
  if (prescription?.guest_phone || prescription?.customer_id) {
    try {
      await notificationModuleService.createNotifications({
        to: prescription.guest_phone || prescription.customer_id,
        channel: "sms",
        template: "T05_RX_APPROVED",
        data: {
          prescription_id: data.id,
        },
      })
    } catch (err) {
      logger.warn(
        `prescription.fully-approved SMS skipped (no provider?): ${(err as Error).message}`
      )
      captureException(err, { subscriber: "prescription-fully-approved", prescriptionId: data.id, step: "send-sms" })
    }
  }

  if (prescription?.customer_id) {
    const result = await sendPushToCustomerTopic(prescription.customer_id, {
      title: "Prescription Approved",
      body: "Your prescription has been approved. You can continue checkout.",
      data: {
        type: "rx_approved",
        prescription_id: data.id,
        url: "/in/upload-rx",
      },
    })

    if (!result.ok) {
      logger.warn(
        `prescription.fully-approved push skipped for Rx ${data.id}: ${result.reason}`
      )
    }

    // Send email notification to customer
    try {
      const customerService = container.resolve(Modules.CUSTOMER) as any
      const customer = await customerService.retrieveCustomer(prescription.customer_id)

      if (customer?.email) {
        await notificationModuleService.createNotifications({
          to: customer.email,
          channel: "email",
          template: "prescription-approved",
          data: {
            prescription_id: data.id,
            doctor_name: prescription.doctor_name || "your doctor",
            valid_until: prescription.valid_until
              ? new Date(prescription.valid_until).toLocaleDateString("en-IN")
              : "N/A",
            shop_url: `${process.env.STOREFRONT_URL || "https://suprameds.in"}/in/upload-rx`,
          },
        })
        logger.info(
          `prescription.fully-approved email sent to ${customer.email} for Rx ${data.id}`
        )
      } else {
        logger.warn(
          `prescription.fully-approved: customer ${prescription.customer_id} has no email — skipping email`
        )
      }
    } catch (emailErr) {
      logger.warn(
        `prescription.fully-approved email failed for Rx ${data.id}: ${(emailErr as Error).message}`
      )
      captureException(emailErr, { subscriber: "prescription-fully-approved", prescriptionId: data.id, step: "send-email" })
    }
  }

  logger.info(`prescription.fully-approved handled for Rx: ${data.id}`)
}

export const config: SubscriberConfig = {
  event: "prescription.fully-approved",
}
