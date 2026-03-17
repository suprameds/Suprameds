import type { SubscriberArgs, SubscriberConfig } from "@medusajs/framework"
import { INotificationModuleService } from "@medusajs/framework/types"
import { Modules } from "@medusajs/framework/utils"
import { PRESCRIPTION_MODULE } from "../modules/prescription"

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

  // Send SMS to customer (T05_RX_APPROVED)
  if (prescription?.guest_phone || prescription?.customer_id) {
     await notificationModuleService.createNotifications({
      to: prescription.guest_phone || prescription.customer_id, // Simplified for now
      channel: "sms",
      template: "T05_RX_APPROVED",
      data: {
        prescription_id: data.id,
      },
    })
  }

  console.info(`[subscriber] prescription.fully-approved handled for Rx: ${data.id}`)
}

export const config: SubscriberConfig = {
  event: "prescription.fully-approved",
}
