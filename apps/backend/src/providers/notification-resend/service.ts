import {
  AbstractNotificationProviderService,
  MedusaError,
} from "@medusajs/framework/utils"
import { Resend } from "resend"
import { render } from "@react-email/render"

type ResendOptions = {
  api_key: string
  from: string
  channels?: string[]
}

type InjectedDependencies = {
  logger: any
}

// ── Template registry ────────────────────────────────────────────────
// Each template returns { subject, html } given arbitrary data.

type TemplateResult = { subject: string; html: string }
type TemplateRenderer = (data: Record<string, unknown>) => TemplateResult

const BRAND = {
  navy: "#1E2D5A",
  green: "#27AE60",
  cream: "#FAFAF8",
  charcoal: "#2C3E50",
  name: "Suprameds",
}

function wrapInLayout(title: string, body: string): string {
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"><title>${title}</title></head>
<body style="margin:0;padding:0;background:${BRAND.cream};font-family:'DM Sans',Helvetica,Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:${BRAND.cream};padding:32px 16px;">
<tr><td align="center">
<table width="520" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:8px;border:1px solid #e5e7eb;overflow:hidden;">
<tr><td style="background:${BRAND.navy};padding:24px 32px;text-align:center;">
  <span style="color:#ffffff;font-size:22px;font-weight:700;letter-spacing:0.5px;">${BRAND.name}</span>
</td></tr>
<tr><td style="padding:32px;">${body}</td></tr>
<tr><td style="padding:16px 32px;border-top:1px solid #e5e7eb;text-align:center;">
  <span style="color:#9ca3af;font-size:12px;">© ${new Date().getFullYear()} Suprameds (Supracyn Pharma Pvt. Ltd.) — Licensed Online Pharmacy</span>
</td></tr>
</table>
</td></tr></table></body></html>`
}

const templates: Record<string, TemplateRenderer> = {
  "user-invited": (data) => {
    const inviteUrl = data.invite_url as string || "#"
    return {
      subject: "You're invited to join Suprameds Admin",
      html: wrapInLayout("You're Invited!", `
        <h2 style="color:${BRAND.navy};font-size:20px;margin:0 0 16px;">You're Invited!</h2>
        <p style="color:${BRAND.charcoal};font-size:14px;line-height:22px;margin:0 0 8px;">
          You've been invited to join the <strong>Suprameds Admin Dashboard</strong>.
        </p>
        <p style="color:${BRAND.charcoal};font-size:14px;line-height:22px;margin:0 0 24px;">
          Click the button below to accept the invitation and set up your account.
        </p>
        <div style="text-align:center;margin:24px 0;">
          <a href="${inviteUrl}" style="display:inline-block;background:${BRAND.green};color:#ffffff;font-size:14px;font-weight:600;padding:12px 28px;border-radius:6px;text-decoration:none;">
            Accept Invitation
          </a>
        </div>
        <p style="color:#6b7280;font-size:12px;line-height:20px;margin:16px 0 0;word-break:break-all;">
          Or copy this link: <a href="${inviteUrl}" style="color:${BRAND.green};">${inviteUrl}</a>
        </p>
        <p style="color:#9ca3af;font-size:12px;margin:24px 0 0;">
          If you weren't expecting this invitation, you can safely ignore this email.
        </p>
      `),
    }
  },

  "order-confirmation": (data) => {
    const orderId = (data.display_id || data.order_id || "N/A") as string
    const total = data.total as number | undefined
    const items = (data.items as Array<{ title: string; quantity: number; unit_price: number }>) || []
    const addr = data.shipping_address as Record<string, string> | undefined

    const itemRows = items.map((i) =>
      `<tr><td style="padding:8px 0;border-bottom:1px solid #f3f4f6;font-size:13px;color:${BRAND.charcoal};">${i.title}</td>
       <td style="padding:8px 0;border-bottom:1px solid #f3f4f6;font-size:13px;text-align:center;">${i.quantity}</td>
       <td style="padding:8px 0;border-bottom:1px solid #f3f4f6;font-size:13px;text-align:right;">₹${i.unit_price}</td></tr>`
    ).join("")

    return {
      subject: `Suprameds — Order #${orderId} Confirmed`,
      html: wrapInLayout("Order Confirmed", `
        <h2 style="color:${BRAND.navy};font-size:20px;margin:0 0 8px;">Order Confirmed</h2>
        <p style="color:${BRAND.charcoal};font-size:14px;margin:0 0 24px;">
          Thank you! Your order <strong>#${orderId}</strong> has been placed successfully.
        </p>
        ${items.length > 0 ? `
        <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:16px;">
          <tr style="border-bottom:2px solid ${BRAND.navy};">
            <th style="text-align:left;padding:8px 0;font-size:12px;color:${BRAND.navy};">Item</th>
            <th style="text-align:center;padding:8px 0;font-size:12px;color:${BRAND.navy};">Qty</th>
            <th style="text-align:right;padding:8px 0;font-size:12px;color:${BRAND.navy};">Price</th>
          </tr>
          ${itemRows}
        </table>` : ""}
        ${total != null ? `<p style="font-size:16px;font-weight:700;color:${BRAND.navy};text-align:right;margin:8px 0 16px;">Total: ₹${total}</p>` : ""}
        ${addr ? `<p style="color:#6b7280;font-size:13px;margin:0;">Shipping to: ${addr.address_1 || ""}, ${addr.city || ""} ${addr.postal_code || ""}</p>` : ""}
      `),
    }
  },

  "welcome": (data) => {
    const firstName = (data.first_name as string) || "there"
    return {
      subject: "Welcome to Suprameds!",
      html: wrapInLayout("Welcome!", `
        <h2 style="color:${BRAND.navy};font-size:20px;margin:0 0 16px;">Welcome, ${firstName}!</h2>
        <p style="color:${BRAND.charcoal};font-size:14px;line-height:22px;margin:0 0 8px;">
          Thank you for creating your Suprameds account. You now have access to:
        </p>
        <ul style="color:${BRAND.charcoal};font-size:14px;line-height:24px;padding-left:20px;margin:0 0 24px;">
          <li>Quick reordering of your medicines</li>
          <li>Easy prescription uploads</li>
          <li>Order tracking from dispatch to delivery</li>
          <li>Free delivery on orders above ₹300</li>
        </ul>
        <div style="text-align:center;margin:24px 0;">
          <a href="https://suprameds.in/in/store" style="display:inline-block;background:${BRAND.green};color:#ffffff;font-size:14px;font-weight:600;padding:12px 28px;border-radius:6px;text-decoration:none;">
            Browse Medicines
          </a>
        </div>
        <p style="color:#9ca3af;font-size:12px;margin:24px 0 0;">
          Have a prescription? Upload it after placing your order — our pharmacist will review it within minutes.
        </p>
      `),
    }
  },

  "payment-confirmed": (data) => {
    const orderId = (data.display_id || data.order_id || "N/A") as string
    const amount = data.amount as number | undefined
    const currency = (data.currency_code as string || "INR").toUpperCase()
    const symbol = currency === "INR" ? "₹" : currency + " "

    return {
      subject: `Suprameds — Payment Received for Order #${orderId}`,
      html: wrapInLayout("Payment Confirmed", `
        <h2 style="color:${BRAND.navy};font-size:20px;margin:0 0 16px;">Payment Confirmed</h2>
        <p style="color:${BRAND.charcoal};font-size:14px;line-height:22px;margin:0 0 8px;">
          We've received your payment for order <strong>#${orderId}</strong>.
        </p>
        ${amount != null ? `<p style="font-size:18px;font-weight:700;color:${BRAND.green};margin:16px 0;">Amount: ${symbol}${amount}</p>` : ""}
        <p style="color:${BRAND.charcoal};font-size:14px;line-height:22px;margin:0 0 24px;">
          Your order is being prepared and will be dispatched shortly. You'll receive a notification when it's on its way.
        </p>
        <p style="color:#9ca3af;font-size:12px;margin:24px 0 0;">
          For any queries, reach out to us at support@suprameds.in
        </p>
      `),
    }
  },

  "password-reset": (data) => {
    const resetUrl = (data.reset_url || data.url) as string || "#"
    return {
      subject: "Reset your Suprameds password",
      html: wrapInLayout("Password Reset", `
        <h2 style="color:${BRAND.navy};font-size:20px;margin:0 0 16px;">Password Reset</h2>
        <p style="color:${BRAND.charcoal};font-size:14px;line-height:22px;margin:0 0 24px;">
          We received a request to reset your password. Click below to set a new one.
        </p>
        <div style="text-align:center;margin:24px 0;">
          <a href="${resetUrl}" style="display:inline-block;background:${BRAND.green};color:#ffffff;font-size:14px;font-weight:600;padding:12px 28px;border-radius:6px;text-decoration:none;">
            Reset Password
          </a>
        </div>
        <p style="color:#9ca3af;font-size:12px;margin:24px 0 0;">
          If you didn't request this, ignore this email — your password won't change.
        </p>
      `),
    }
  },
}

// ── React Email template registry ────────────────────────────────────
// Maps template names to lazy-loaded React Email modules.
// Each module must export: default (component) + subject (fn → string).

type ReactEmailModule = {
  default: (props: any) => React.ReactElement
  subject: (data: Record<string, unknown>) => string
}

const reactEmailTemplates: Record<string, () => Promise<ReactEmailModule>> = {
  "prescription-approved": () => import("../../email-templates/prescription-approved.js") as any,
  "prescription-rejected": () => import("../../email-templates/prescription-rejected.js") as any,
  "shipping-confirmation": () => import("../../email-templates/shipping-confirmation.js") as any,
  "delivery-confirmation": () => import("../../email-templates/delivery-confirmation.js") as any,
  "refund-processed": () => import("../../email-templates/refund-processed.js") as any,
  "order-canceled": () => import("../../email-templates/order-canceled.js") as any,
  "pharmacist-order-created": () => import("../../email-templates/pharmacist-order-created.js") as any,
}

/**
 * Resend-based email notification provider for Medusa v2.
 * Supports React Email components, inline templates, and raw html.
 *
 * Sender: support@supracynpharma.com (verified domain)
 */
class ResendNotificationProviderService extends AbstractNotificationProviderService {
  static identifier = "resend"
  private resend: Resend
  private from: string
  private logger: any
  private isConfigured: boolean

  constructor(container: InjectedDependencies, options: ResendOptions) {
    super()
    this.logger = container.logger
    this.from = options.from || "Suprameds <support@supracynpharma.com>"
    this.isConfigured = Boolean(options.api_key)

    if (!this.isConfigured) {
      this.logger.warn(
        "[resend] No RESEND_API_KEY provided — emails will not be sent"
      )
    }

    this.resend = new Resend(options.api_key || "re_placeholder")
  }

  async send(notification: Record<string, unknown>): Promise<{ id: string }> {
    if (!this.isConfigured) {
      this.logger.warn(
        `[resend] Skipping email to ${notification.to ?? "unknown"} — RESEND_API_KEY not configured`
      )
      return { id: "noop-not-configured" }
    }

    const to = notification.to as string
    if (!to) {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        "Email recipient (to) is required"
      )
    }

    const templateName = notification.template as string | undefined
    const templateData = (notification.data as Record<string, unknown>) || {}
    let subject: string
    let html: string

    if (templateName && reactEmailTemplates[templateName]) {
      // Priority 1: React Email component
      const mod = await reactEmailTemplates[templateName]()
      const Component = mod.default
      subject = mod.subject(templateData)
      html = await render(Component(templateData as any))
      this.logger.info(`[resend] Rendered React Email template "${templateName}" for ${to}`)
    } else if (templateName && templates[templateName]) {
      // Priority 2: Inline template
      const rendered = templates[templateName](templateData)
      subject = rendered.subject
      html = rendered.html
      this.logger.info(`[resend] Rendering inline template "${templateName}" for ${to}`)
    } else {
      // Fallback: look for subject/html in data
      subject =
        (notification.subject as string) ||
        (templateData.subject as string) ||
        "Suprameds Update"
      html =
        (notification.html as string) ||
        (templateData.html as string) ||
        ""
      if (templateName) {
        this.logger.warn(`[resend] Unknown template "${templateName}" — falling back to raw html`)
      }
    }

    try {
      const result = await this.resend.emails.send({
        from: this.from,
        to: [to],
        subject,
        html,
        text: (notification.text as string) || undefined,
      })

      if (result.error) {
        this.logger.error(
          `[resend] Failed to send to ${to}: ${result.error.message}`
        )
        throw new MedusaError(
          MedusaError.Types.UNEXPECTED_STATE,
          `Resend error: ${result.error.message}`
        )
      }

      this.logger.info(
        `[resend] Email sent to ${to} — id: ${result.data?.id}`
      )

      return { id: result.data?.id || "sent" }
    } catch (err: any) {
      this.logger.error(`[resend] Send failed: ${err?.message}`)
      throw err
    }
  }
}

export default ResendNotificationProviderService
