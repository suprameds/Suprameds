import { MedusaService } from "@medusajs/framework/utils"
import NotificationTemplate from "./models/notification-template"
import InternalNotification from "./models/internal-notification"

/**
 * NotificationModuleService — SMS (MSG91), WhatsApp, Email, in-app notifications.
 * Enforces DLT template compliance for all SMS sends.
 */
class NotificationModuleService extends MedusaService({
  NotificationTemplate,
  InternalNotification,
}) {
  // TODO: sendSms(), sendWhatsApp(), sendEmail(), sendInApp(),
  //       checkOptIn(), registerDltTemplate()
}

export default NotificationModuleService
