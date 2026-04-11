import {
  AbstractNotificationProviderService,
  MedusaError,
} from "@medusajs/framework/utils"

type BulkSmsOptions = {
  api_id: string
  api_password: string
  sender_id: string
  channels?: string[]
}

type InjectedDependencies = {
  logger: any
}

const BASE_URL = "https://www.bulksmsplans.com/api"

/**
 * DLT-registered template registry.
 *
 * Maps internal event names → { dlt_template_id, text(data) }.
 * The `{#var#}` placeholder in DLT templates maps to dynamic values.
 * Template text MUST exactly match what's registered on the DLT portal.
 */
const SMS_TEMPLATES: Record<
  string,
  { dlt_template_id: string; text: (data: Record<string, unknown>) => string }
> = {
  "otp_sent": {
    dlt_template_id: process.env.BULKSMS_DLT_OTP_TEMPLATE_ID || "",
    text: (data) => `${data.otp} is your verification code for SUPRAMEDS.`,
  },
  "order_place": {
    dlt_template_id: process.env.BULKSMS_DLT_ORDER_PLACE_ID || "",
    text: (data) =>
      `Thanks for shopping with us! We have received your order ${data.display_id || data.order_id}. We will notify you once the product is dispatched. Regards, SUPRAMEDS.`,
  },
  "order_confirmed": {
    dlt_template_id: process.env.BULKSMS_DLT_ORDER_CONFIRMED_ID || "",
    text: (data) =>
      `Your order ${data.display_id || data.order_id} has been confirmed and Ready to ship. Regards, SUPRAMEDS.`,
  },
  "order_shipped": {
    dlt_template_id: process.env.BULKSMS_DLT_ORDER_SHIPPED_ID || "",
    text: (data) =>
      `Your products of your order ${data.display_id || data.order_id} have been shipped successfully. We will be delivering the order soon. Regards, SUPRAMEDS.`,
  },
  "order_delivered": {
    dlt_template_id: process.env.BULKSMS_DLT_ORDER_DELIVERED_ID || "",
    text: (data) =>
      `Your products of your order ${data.display_id || data.order_id} has been delivered successfully. We wish you good health and hope to serve you again. Regards, SUPRAMEDS.`,
  },
  "order_rejected": {
    dlt_template_id: process.env.BULKSMS_DLT_ORDER_REJECTED_ID || "",
    text: (data) =>
      `Your order ${data.display_id || data.order_id} has been rejected. In case of any concern related to the order, you can always reach us. Regards, SUPRAMEDS.`,
  },
  "order_updated": {
    dlt_template_id: process.env.BULKSMS_DLT_ORDER_UPDATED_ID || "",
    text: (data) =>
      `Your order ${data.display_id || data.order_id} has been updated. Regards, SUPRAMEDS.`,
  },
}

/**
 * BulkSMSPlans.com notification provider for Medusa v2.
 *
 * Sends transactional SMS via HTTP GET/POST API using DLT-registered templates.
 * Used for order lifecycle notifications and OTP delivery.
 *
 * API docs: https://bulksmsplans.com/bulk-sms-api
 * DLT Entity: SUPRACYN PRIVATE LIMITED (1501684950000036033)
 */
class BulkSmsNotificationProviderService extends AbstractNotificationProviderService {
  static identifier = "bulksms"
  private apiId: string
  private apiPassword: string
  private senderId: string
  private logger: any
  private isConfigured: boolean

  constructor(container: InjectedDependencies, options: BulkSmsOptions) {
    super()
    this.logger = container.logger
    this.apiId = options.api_id || ""
    this.apiPassword = options.api_password || ""
    this.senderId = options.sender_id || "Suprra"
    this.isConfigured = Boolean(this.apiId && this.apiPassword)

    if (!this.isConfigured) {
      this.logger.warn(
        "[bulksms] BULKSMS_API_ID or BULKSMS_API_PASSWORD not configured — SMS will not be sent"
      )
    }
  }

  async send(notification: Record<string, unknown>): Promise<{ id: string }> {
    if (!this.isConfigured) {
      this.logger.warn(
        `[bulksms] Skipping SMS to ${notification.to ?? "unknown"} — not configured`
      )
      return { id: "noop-not-configured" }
    }

    const to = notification.to as string
    if (!to) {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        "SMS recipient (to) is required"
      )
    }

    // Normalise phone: ensure it starts with 91
    const phone = to.replace(/[^0-9]/g, "").replace(/^0+/, "")
    const fullPhone = phone.startsWith("91") ? phone : `91${phone}`

    const templateName = notification.template as string | undefined
    const templateData = (notification.data as Record<string, unknown>) || {}

    let message: string
    let templateId: string

    if (templateName && SMS_TEMPLATES[templateName]) {
      const tpl = SMS_TEMPLATES[templateName]
      message = tpl.text(templateData)
      templateId = tpl.dlt_template_id
    } else {
      // Fallback: raw message (must still match a DLT template)
      message = (notification.message as string) || (templateData.message as string) || ""
      templateId = (notification.template_id as string) || (templateData.template_id as string) || ""
    }

    if (!message) {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        `[bulksms] No message content for template "${templateName}"`
      )
    }

    try {
      const params = new URLSearchParams({
        api_id: this.apiId,
        api_password: this.apiPassword,
        sms_type: "Transactional",
        sms_encoding: "text",
        sender: this.senderId,
        number: fullPhone,
        message,
        ...(templateId ? { template_id: templateId } : {}),
      })

      const url = `${BASE_URL}/send_sms?${params.toString()}`
      const response = await fetch(url)
      const result = (await response.json()) as Record<string, unknown>

      if (!response.ok || result.status === "error") {
        this.logger.error(
          `[bulksms] Failed to send SMS to ${fullPhone}: ${JSON.stringify(result)}`
        )
        throw new MedusaError(
          MedusaError.Types.UNEXPECTED_STATE,
          `BulkSMS error: ${result.message || result.error || "Unknown error"}`
        )
      }

      this.logger.info(
        `[bulksms] SMS sent to ${fullPhone} — template: ${templateName}, response: ${JSON.stringify(result)}`
      )

      return { id: String(result.message_id || result.request_id || "sent") }
    } catch (err: any) {
      if (err instanceof MedusaError) throw err
      this.logger.error(`[bulksms] Request failed: ${err?.message}`)
      throw new MedusaError(
        MedusaError.Types.UNEXPECTED_STATE,
        `BulkSMS request failed: ${err?.message}`
      )
    }
  }

  /**
   * Standalone OTP sender — used directly from OTP routes.
   * Bypasses the Medusa notification pipeline for speed.
   */
  async sendOtp(phone: string, otp: string): Promise<{ success: boolean; message?: string }> {
    if (!this.isConfigured) {
      return { success: false, message: "BulkSMS not configured" }
    }

    const fullPhone = phone.replace(/[^0-9]/g, "").replace(/^0+/, "")
    const normalised = fullPhone.startsWith("91") ? fullPhone : `91${fullPhone}`
    const templateId = process.env.BULKSMS_DLT_OTP_TEMPLATE_ID || ""
    const message = `${otp} is your verification code for SUPRAMEDS.`

    try {
      const params = new URLSearchParams({
        api_id: this.apiId,
        api_password: this.apiPassword,
        sms_type: "OTP",
        sms_encoding: "text",
        sender: this.senderId,
        number: normalised,
        message,
        ...(templateId ? { template_id: templateId } : {}),
      })

      const url = `${BASE_URL}/send_sms?${params.toString()}`
      const response = await fetch(url)
      const result = (await response.json()) as Record<string, unknown>

      if (!response.ok || result.status === "error") {
        this.logger.error(`[bulksms] OTP send failed: ${JSON.stringify(result)}`)
        return { success: false, message: String(result.message || "SMS send failed") }
      }

      this.logger.info(`[bulksms] OTP sent to ${normalised}`)
      return { success: true }
    } catch (err: any) {
      this.logger.error(`[bulksms] OTP request error: ${err?.message}`)
      return { success: false, message: err?.message }
    }
  }
}

export default BulkSmsNotificationProviderService
