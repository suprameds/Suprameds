import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { buildGstInvoice } from "../../../../../utils/gst-invoice"
import { generateInvoicePdf } from "../../../../../utils/invoice-pdf"

/**
 * GET /admin/invoices/:orderId/pdf
 *
 * Generate and download the GST invoice as a PDF for the given order.
 * Returns `application/pdf` with proper headers for browser download.
 */
export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const logger = req.scope.resolve(ContainerRegistrationKeys.LOGGER) as any
  const { orderId } = req.params

  if (!orderId) {
    return res.status(400).json({ message: "orderId parameter is required" })
  }

  try {
    const invoice = await buildGstInvoice(req.scope, orderId)
    const pdfBuffer = await generateInvoicePdf(invoice)

    const filename = `invoice-${invoice.invoice_number}.pdf`

    res.setHeader("Content-Type", "application/pdf")
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`)
    res.setHeader("Content-Length", pdfBuffer.length)

    return res.end(pdfBuffer)
  } catch (err: any) {
    logger.error(`[invoice-pdf] Failed for order ${orderId}: ${err?.message}`)
    return res
      .status(500)
      .json({ message: err?.message || "Failed to generate invoice PDF" })
  }
}
