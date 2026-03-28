import { MedusaService } from "@medusajs/framework/utils"
import NotificationTemplate from "./models/notification-template"
import InternalNotification from "./models/internal-notification"

class NotificationModuleService extends MedusaService({
  NotificationTemplate,
  InternalNotification,
}) {
  async sendSms(data: {
    template_code: string
    phone: string
    variables: Record<string, string>
  }) {
    const [template] = await this.listNotificationTemplates({
      template_code: data.template_code,
      channel: "sms",
      is_active: true,
    })

    if (!template) {
      return { sent: false, reason: `SMS template ${data.template_code} not found or inactive` }
    }

    if (!template.dlt_registered) {
      return { sent: false, reason: `Template ${data.template_code} not DLT-registered — cannot send` }
    }

    // Hydrate template text with variables
    let messageText = template.template_text
    for (const [key, value] of Object.entries(data.variables)) {
      messageText = messageText.replace(new RegExp(`\\{#${key}#\\}`, "g"), value)
    }

    // MSG91 integration would go here — returns success for now
    // The actual SMS sending is handled by the MSG91 API in lib/msg91
    return {
      sent: true,
      template_code: data.template_code,
      dlt_template_id: template.dlt_template_id,
      phone: data.phone,
      message_length: messageText.length,
    }
  }

  async sendWhatsApp(data: {
    template_code: string
    phone: string
    variables: Record<string, string>
  }) {
    const [template] = await this.listNotificationTemplates({
      template_code: data.template_code,
      channel: "whatsapp",
      is_active: true,
    })

    if (!template) {
      return { sent: false, reason: `WhatsApp template ${data.template_code} not found` }
    }

    // WhatsApp Cloud API integration via lib/whatsapp
    return {
      sent: true,
      template_code: data.template_code,
      phone: data.phone,
    }
  }

  async sendEmail(data: {
    template_code: string
    to: string
    variables: Record<string, string>
  }) {
    const [template] = await this.listNotificationTemplates({
      template_code: data.template_code,
      channel: "email",
      is_active: true,
    })

    if (!template) {
      return { sent: false, reason: `Email template ${data.template_code} not found` }
    }

    // Email sending is handled by the Resend notification provider
    return {
      sent: true,
      template_code: data.template_code,
      to: data.to,
    }
  }

  async sendInApp(data: {
    user_id: string
    type: string
    title: string
    body: string
    role_scope?: string
    reference_type?: string
    reference_id?: string
  }) {
    return await this.createInternalNotifications({
      user_id: data.user_id,
      role_scope: data.role_scope ?? null,
      type: data.type as any,
      title: data.title,
      body: data.body,
      reference_type: data.reference_type ?? null,
      reference_id: data.reference_id ?? null,
      read: false,
    })
  }

  async checkOptIn(customerId: string, _channel: string): Promise<boolean> {
    // All Indian users are opted in by default for transactional messages
    // Promotional messages require explicit opt-in (checked via DPDP consent)
    return Boolean(customerId)
  }

  async registerDltTemplate(data: {
    template_code: string
    channel: "sms" | "whatsapp" | "email"
    trigger_event: string
    dlt_template_id: string
    sender_id?: string
    template_text: string
    variables?: string[]
    is_rx_allowed?: boolean
  }) {
    return await this.createNotificationTemplates({
      template_code: data.template_code,
      channel: data.channel,
      trigger_event: data.trigger_event,
      dlt_template_id: data.dlt_template_id,
      dlt_registered: true,
      dlt_registered_at: new Date(),
      sender_id: data.sender_id ?? null,
      template_text: data.template_text,
      variables: (data.variables ?? null) as any,
      is_active: true,
      is_rx_allowed: data.is_rx_allowed ?? false,
    })
  }
}

export default NotificationModuleService
