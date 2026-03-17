import type { SubscriberArgs, SubscriberConfig } from "@medusajs/framework"
import { INotificationModuleService } from "@medusajs/framework/types"
import { Modules } from "@medusajs/framework/utils"
import { PRESCRIPTION_MODULE } from "../modules/prescription"

/** Fires when Rx rejected. SMS T06. */
export default async function prescriptionRejectedHandler({
  event: { data },
  container,
}: SubscriberArgs<{ id: string }>) {
  const notificationModuleService: INotificationModuleService = container.resolve(
    Modules.NOTIFICATION
  )
  const prescriptionModule: any = container.resolve(PRESCRIPTION_MODULE)
  const [prescription] = await prescriptionModule.listPrescriptions({ id: data.id })

  // Send SMS to customer (T06_RX_REJECTED)
  if (prescription?.guest_phone || prescription?.customer_id) {
     await notificationModuleService.createNotifications({
      to: prescription.guest_phone || prescription.customer_id,
      channel: "sms",
      template: "T06_RX_REJECTED",
      data: {
        prescription_id: data.id,
        reason: prescription.rejection_reason
      },
    })
  }

  console.info(`[subscriber] prescription.rejected handled for Rx: ${data.id}`)
}

export const config: SubscriberConfig = {
  event: "prescription.rejected",
}
