import type { SubscriberArgs, SubscriberConfig } from "@medusajs/framework"
import { INotificationModuleService } from "@medusajs/framework/types"
import { Modules } from "@medusajs/framework/utils"

/**
 * Fires when a new prescription is uploaded.
 * Queues for pharmacist review, sends internal email.
 */
export default async function prescriptionUploadedHandler({
  event: { data },
  container,
}: SubscriberArgs<{ id: string }>) {
  const notificationModuleService: INotificationModuleService = container.resolve(
    Modules.NOTIFICATION
  )

  // Send internal notification to pharmacy team
  await notificationModuleService.createNotifications({
    to: "pharmacist@suprameds.in",
    channel: "email",
    template: "rx-uploaded",
    data: {
      prescription_id: data.id,
    },
  })

  console.info(`[subscriber] prescription.uploaded handled for Rx: ${data.id}`)
}

export const config: SubscriberConfig = {
  event: "prescription.uploaded",
}
