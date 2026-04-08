import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import { buildGstInvoice } from "../../../../../utils/gst-invoice"
import { generateInvoicePdf } from "../../../../../utils/invoice-pdf"

/**
 * POST /store/invoices/:orderId/email
 *
 * Generates the GST invoice PDF for an order and emails it to the
 * authenticated customer as an attachment via Resend.
 *
 * Auth: customer bearer/session (registered in middlewares.ts)
 */
export async function POST(req: MedusaRequest, res: MedusaResponse) {
  const logger = req.scope.resolve(ContainerRegistrationKeys.LOGGER) as any
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY) as any
  const { orderId } = req.params
  const customerId = (req as any).auth_context?.actor_id

  if (!orderId) {
    return res.status(400).json({ message: "orderId parameter is required" })
  }

  if (!customerId) {
    return res.status(401).json({ message: "Authentication required" })
  }

  try {
    // ── Verify the order belongs to this customer ──────────────────────
    const { data: orders } = await query.graph({
      entity: "order",
      fields: ["id", "customer_id", "display_id"],
      filters: { id: orderId },
    })

    const order = (orders as any[])?.[0]
    if (!order) {
      return res.status(404).json({ message: "Order not found" })
    }

    if (order.customer_id !== customerId) {
      return res.status(403).json({ message: "Unauthorized" })
    }

    // ── Fetch customer email ──────────────────────────────────────────
    const customerModule = req.scope.resolve(Modules.CUSTOMER) as any
    const customer = await customerModule.retrieveCustomer(customerId)

    if (!customer?.email) {
      return res.status(400).json({
        message: "No email address found on your account",
      })
    }

    // ── Generate invoice PDF ──────────────────────────────────────────
    const invoice = await buildGstInvoice(req.scope, orderId)
    const pdfBuffer = await generateInvoicePdf(invoice)
    const filename = `invoice-${invoice.invoice_number}.pdf`

    // ── Send via Resend ───────────────────────────────────────────────
    // @ts-ignore — resend is available at runtime via notification-resend provider
    const { Resend } = await import("resend")
    const apiKey = process.env.RESEND_API_KEY

    if (!apiKey) {
      logger.warn("[invoice-email] RESEND_API_KEY not configured — skipping send")
      return res.status(503).json({
        message: "Email service is not configured",
      })
    }

    const resend = new Resend(apiKey)
    const displayId = order.display_id || orderId

    const result = await resend.emails.send({
      from: process.env.RESEND_FROM || "Suprameds <support@supracynpharma.com>",
      to: [customer.email],
      subject: `Suprameds — Invoice for Order #${displayId}`,
      html: buildInvoiceEmailHtml(displayId, customer.first_name),
      attachments: [
        {
          filename,
          content: pdfBuffer.toString("base64"),
        },
      ],
    })

    if (result.error) {
      logger.error(
        `[invoice-email] Resend error for order ${orderId}: ${result.error.message}`
      )
      return res.status(502).json({
        message: "Failed to send invoice email",
      })
    }

    logger.info(
      `[invoice-email] Invoice emailed to ${customer.email} for order ${orderId} — id: ${result.data?.id}`
    )

    return res.json({
      success: true,
      message: "Invoice emailed successfully",
    })
  } catch (err: any) {
    logger.error(
      `[invoice-email] Failed for order ${orderId}: ${err?.message}`
    )
    return res.status(500).json({
      message: err?.message || "Failed to email invoice",
    })
  }
}

// ── Inline email body ─────────────────────────────────────────────────

const BRAND = {
  navy: "#1E2D5A",
  green: "#27AE60",
  cream: "#FAFAF8",
  charcoal: "#2C3E50",
}

function buildInvoiceEmailHtml(
  displayId: string | number,
  firstName?: string
): string {
  const greeting = firstName ? `Hi ${firstName},` : "Hi,"
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"><title>Your Invoice</title></head>
<body style="margin:0;padding:0;background:${BRAND.cream};font-family:'DM Sans',Helvetica,Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:${BRAND.cream};padding:32px 16px;">
<tr><td align="center">
<table width="520" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:8px;border:1px solid #e5e7eb;overflow:hidden;">
<tr><td style="background:${BRAND.navy};padding:24px 32px;text-align:center;">
  <span style="color:#ffffff;font-size:22px;font-weight:700;letter-spacing:0.5px;">Suprameds</span>
</td></tr>
<tr><td style="padding:32px;">
  <h2 style="color:${BRAND.navy};font-size:20px;margin:0 0 16px;">Your Invoice</h2>
  <p style="color:${BRAND.charcoal};font-size:14px;line-height:22px;margin:0 0 8px;">
    ${greeting}
  </p>
  <p style="color:${BRAND.charcoal};font-size:14px;line-height:22px;margin:0 0 24px;">
    Please find the GST invoice for your order <strong>#${displayId}</strong> attached to this email as a PDF.
  </p>
  <p style="color:${BRAND.charcoal};font-size:14px;line-height:22px;margin:0 0 8px;">
    You can also download your invoice anytime from your order history on
    <a href="https://suprameds.in" style="color:${BRAND.green};text-decoration:underline;">suprameds.in</a>.
  </p>
  <p style="color:#9ca3af;font-size:12px;margin:24px 0 0;">
    For any queries, reach out to us at support@suprameds.in
  </p>
</td></tr>
<tr><td style="padding:16px 32px;border-top:1px solid #e5e7eb;text-align:center;">
  <span style="color:#9ca3af;font-size:12px;">&copy; ${new Date().getFullYear()} Suprameds (Supracyn Pharma Pvt. Ltd.) &mdash; Licensed Online Pharmacy</span>
</td></tr>
</table>
</td></tr></table></body></html>`
}
