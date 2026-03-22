import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { buildGstInvoice } from "../../../../../utils/gst-invoice"
import { generateInvoicePdf } from "../../../../../utils/invoice-pdf"

/**
 * GET /store/invoices/:orderId/pdf
 *
 * Customer-facing invoice download. Only returns invoice if
 * the order belongs to the authenticated customer.
 */
export async function GET(req: MedusaRequest, res: MedusaResponse) {
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
    // Verify the order belongs to this customer
    const { data: orders } = await query.graph({
      entity: "order",
      fields: ["id", "customer_id"],
      filters: { id: orderId },
    })

    const order = (orders as any[])?.[0]
    if (!order) {
      return res.status(404).json({ message: "Order not found" })
    }

    if (order.customer_id !== customerId) {
      return res.status(403).json({ message: "Unauthorized" })
    }

    const invoice = await buildGstInvoice(req.scope, orderId)
    const pdfBuffer = await generateInvoicePdf(invoice)
    const filename = `invoice-${invoice.invoice_number}.pdf`

    res.setHeader("Content-Type", "application/pdf")
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`)
    res.setHeader("Content-Length", pdfBuffer.length)

    return res.end(pdfBuffer)
  } catch (err: any) {
    logger.error(
      `[invoice-pdf] Store download failed for order ${orderId}: ${err?.message}`
    )
    return res
      .status(500)
      .json({ message: err?.message || "Failed to generate invoice PDF" })
  }
}
