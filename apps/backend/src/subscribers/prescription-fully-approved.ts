import type { SubscriberArgs, SubscriberConfig } from "@medusajs/framework"
import { INotificationModuleService } from "@medusajs/framework/types"
import { Modules } from "@medusajs/framework/utils"
import { PRESCRIPTION_MODULE } from "../modules/prescription"
import { sendPushToCustomerTopic } from "../lib/firebase-messaging"

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
      console.warn(
        `[subscriber] prescription.fully-approved SMS skipped (no provider?): ${(err as Error).message}`
      )
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
      console.warn(
        `[subscriber] prescription.fully-approved push skipped for Rx ${data.id}: ${result.reason}`
      )
    }
  }

  console.info(`[subscriber] prescription.fully-approved handled for Rx: ${data.id}`)
}

export const config: SubscriberConfig = {
  event: "prescription.fully-approved",
}
