import { model } from "@medusajs/framework/utils"

/**
 * NotificationTemplate — DLT-registered SMS/WhatsApp/Email templates.
 * All SMS templates MUST have a TRAI DLT ID before sending.
 * Rx-related templates cannot be used for promotional purposes.
 */
const NotificationTemplate = model.define("notification_template", {
  id: model.id().primaryKey(),

  // e.g. 'T01_OTP', 'W03_DISPATCH'
  template_code: model.text().unique(),

  // sms | whatsapp | email
  channel: model.enum(["sms", "whatsapp", "email"]),

  // e.g. 'order.confirmed'
  trigger_event: model.text(),

  // TRAI DLT ID — required for all SMS
  dlt_template_id: model.text().nullable(),
  dlt_registered: model.boolean().default(false),
  dlt_registered_at: model.dateTime().nullable(),

  // MSG91 sender ID
  sender_id: model.text().nullable(),

  // Template text with {#var#} placeholders
  template_text: model.text(),

  // Variable names in template
  variables: model.json().nullable(),

  is_active: model.boolean().default(true),

  // false for all promotional templates
  is_rx_allowed: model.boolean().default(false),
})

export default NotificationTemplate
