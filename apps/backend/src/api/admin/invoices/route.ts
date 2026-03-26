import type { AuthenticatedMedusaRequest, MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { PAYMENT_MODULE } from "../../../modules/payment"
import { RBAC_MODULE } from "../../../modules/rbac"
import {
  buildGstInvoice,
  generateMemoNumber,
} from "../../../utils/gst-invoice"

const LOG_PREFIX = "[invoice]"

/**
 * GET /admin/invoices?order_id=...
 * Generate and return a GST invoice for the given order.
 */
export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const logger = req.scope.resolve(ContainerRegistrationKeys.LOGGER) as any
  const orderId = req.query.order_id as string | undefined

  if (!orderId) {
    return res
      .status(400)
      .json({ message: "order_id query parameter is required" })
  }

  try {
    const invoice = await buildGstInvoice(req.scope, orderId)
    return res.json({ invoice })
  } catch (err: any) {
    logger.error(`${LOG_PREFIX} GET failed for order ${orderId}: ${err?.message}`)
    return res
      .status(500)
      .json({ message: err?.message || "Failed to generate invoice" })
  }
}

/**
 * POST /admin/invoices
 * Generate a GST invoice and create the corresponding SupplyMemo record.
 *
 * Body: { order_id, shipment_id?, pharmacist_name, pharmacist_reg }
 */
export async function POST(req: MedusaRequest, res: MedusaResponse) {
  const logger = req.scope.resolve(ContainerRegistrationKeys.LOGGER) as any
  const body = req.body as Record<string, any>
  const actorId = (req as AuthenticatedMedusaRequest).auth_context?.actor_id

  let { order_id, shipment_id, pharmacist_name, pharmacist_reg } = body

  // Auto-fill pharmacist details from StaffCredential if not provided
  if ((!pharmacist_name || !pharmacist_reg) && actorId) {
    try {
      const rbacService = req.scope.resolve(RBAC_MODULE) as any
      const cred = await rbacService.getPharmacistReg(actorId)
      if (cred) {
        if (!pharmacist_name) pharmacist_name = cred.name
        if (!pharmacist_reg) pharmacist_reg = cred.reg_no
        logger.info(`${LOG_PREFIX} Auto-filled pharmacist credential from user profile: ${cred.name} (${cred.reg_no})`)
      }
    } catch (err: any) {
      logger.warn(`${LOG_PREFIX} Could not auto-fill pharmacist credential: ${err.message}`)
    }
  }

  if (!order_id || !pharmacist_name || !pharmacist_reg) {
    return res.status(400).json({
      message:
        "order_id, pharmacist_name, and pharmacist_reg are required. " +
        "Set them in the request body or add a pharmacist_registration credential in Roles & Access.",
    })
  }

  try {
    // 1. Build the full GST invoice
    const invoice = await buildGstInvoice(req.scope, order_id)

    // 2. Persist a SupplyMemo via the payment module
    const paymentService = req.scope.resolve(PAYMENT_MODULE) as any

    const memo = await paymentService.createSupplyMemos({
      memo_number: generateMemoNumber(),
      order_id,
      shipment_id: shipment_id || null,
      customer_name: invoice.buyer_name,
      customer_address: invoice.buyer_address,
      prescription_ref: invoice.prescription_ref || null,
      pharmacist_name,
      pharmacist_reg,
      pharmacy_license: invoice.seller_dl_number,
      items: invoice.items,
      total_mrp: invoice.subtotal,
      total_discount: invoice.total_discount,
      total_gst: invoice.total_gst,
      total_payable: invoice.grand_total,
      payment_mode: invoice.payment_mode,
      generated_at: new Date(),
      metadata: {
        invoice_number: invoice.invoice_number,
        invoice_date: invoice.invoice_date,
        seller_gstin: invoice.seller_gstin,
        is_intra_state: invoice.is_intra_state,
        total_cgst: invoice.total_cgst,
        total_sgst: invoice.total_sgst,
        total_igst: invoice.total_igst,
      },
    })

    // Attach memo number back to the invoice response
    invoice.supply_memo_number = memo.memo_number

    logger.info(
      `${LOG_PREFIX} Created invoice ${invoice.invoice_number} + memo ${memo.memo_number} for order ${order_id}`
    )

    return res.status(201).json({ invoice, supply_memo: memo })
  } catch (err: any) {
    logger.error(
      `${LOG_PREFIX} POST failed for order ${order_id}: ${err?.message}`
    )
    return res
      .status(500)
      .json({ message: err?.message || "Failed to create invoice and supply memo" })
  }
}
