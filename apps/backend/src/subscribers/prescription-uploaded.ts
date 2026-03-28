import type { SubscriberArgs, SubscriberConfig } from "@medusajs/framework"
import { INotificationModuleService } from "@medusajs/framework/types"
import { Modules } from "@medusajs/framework/utils"
import { captureException } from "../lib/sentry"

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

  // Send internal notification to pharmacy team — wrapped in try/catch
  // so a missing template or transient email failure doesn't crash the event pipeline
  try {
    await notificationModuleService.createNotifications({
      to: "pharmacist@suprameds.in",
      channel: "email",
      template: "rx-uploaded",
      data: {
        prescription_id: data.id,
        subject: `New Prescription Uploaded — ${data.id}`,
        html: `<p>A new prescription <strong>${data.id}</strong> has been uploaded and is awaiting review.</p><p><a href="${process.env.BACKEND_URL || "http://localhost:9000"}/app/prescriptions/${data.id}">Review in Admin</a></p>`,
      },
    })
  } catch (err) {
    console.warn(
      `[subscriber] prescription.uploaded email skipped: ${(err as Error).message}`
    )
    captureException(err, { subscriber: "prescription-uploaded", prescriptionId: data.id })
  }

  console.info(`[subscriber] prescription.uploaded handled for Rx: ${data.id}`)
}

export const config: SubscriberConfig = {
  event: "prescription.uploaded",
}
