import type { SubscriberArgs, SubscriberConfig } from "@medusajs/framework"
import { INotificationModuleService } from "@medusajs/framework/types"
import { Modules } from "@medusajs/framework/utils"
import { PRESCRIPTION_MODULE } from "../modules/prescription"
import { sendPushToCustomerTopic } from "../lib/firebase-messaging"

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

  if (prescription?.customer_id) {
    const result = await sendPushToCustomerTopic(prescription.customer_id, {
      title: "Prescription Rejected",
      body: "Your prescription was rejected. Please upload a valid one to proceed.",
      data: {
        type: "rx_rejected",
        prescription_id: data.id,
        url: "/in/upload-rx",
      },
    })

    if (!result.ok) {
      console.warn(
        `[subscriber] prescription.rejected push skipped for Rx ${data.id}: ${result.reason}`
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
          template: "prescription-rejected",
          data: {
            prescription_id: data.id,
            rejection_reason: prescription.rejection_reason || "The uploaded document could not be verified.",
            reupload_url: `${process.env.STOREFRONT_URL || "https://suprameds.in"}/in/upload-rx`,
          },
        })
        console.info(
          `[subscriber] prescription.rejected email sent to ${customer.email} for Rx ${data.id}`
        )
      } else {
        console.warn(
          `[subscriber] prescription.rejected: customer ${prescription.customer_id} has no email — skipping email`
        )
      }
    } catch (emailErr) {
      console.warn(
        `[subscriber] prescription.rejected email failed for Rx ${data.id}: ${(emailErr as Error).message}`
      )
    }
  }

  console.info(`[subscriber] prescription.rejected handled for Rx: ${data.id}`)
}

export const config: SubscriberConfig = {
  event: "prescription.rejected",
}
