import type { MedusaRequest } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { PRESCRIPTION_MODULE } from "../modules/prescription"
import { WAREHOUSE_MODULE } from "../modules/warehouse"
import { INVENTORY_BATCH_MODULE } from "../modules/inventoryBatch"
import { PAYMENT_MODULE } from "../modules/payment"

/**
 * SSD-01: Prescription approval — the pharmacist approving a prescription
 * must not be the same user who uploaded it (customer_id on the prescription).
 *
 * Resolves the customer_id of the prescription from req.params.id.
 */
export async function getPrescriptionUploader(
  req: MedusaRequest
): Promise<string | null> {
  try {
    const prescriptionId = req.params.id
    if (!prescriptionId) return null

    const prescriptionService = req.scope.resolve(PRESCRIPTION_MODULE) as any

    const [prescription] = await prescriptionService.listPrescriptions(
      { id: prescriptionId },
      { select: ["customer_id"] }
    )

    return prescription?.customer_id ?? null
  } catch (err: any) {
    const logger = req.scope.resolve("logger") as any
    logger.warn(
      `[ssd] getPrescriptionUploader failed: ${err.message}. Returning null.`
    )
    return null
  }
}

/**
 * SSD-02: GRN approval — the user who QC-approves a GRN must not be the
 * same user who received the goods (received_by on the grn_record).
 *
 * Resolves the received_by of the GRN record from req.params.id.
 */
export async function getGrnCreator(
  req: MedusaRequest
): Promise<string | null> {
  try {
    const grnId = req.params.id
    if (!grnId) return null

    const warehouseService = req.scope.resolve(WAREHOUSE_MODULE) as any

    const [grn] = await warehouseService.listGrnRecords(
      { id: grnId },
      { select: ["received_by"] }
    )

    return grn?.received_by ?? null
  } catch (err: any) {
    const logger = req.scope.resolve("logger") as any
    logger.warn(
      `[ssd] getGrnCreator failed: ${err.message}. Returning null.`
    )
    return null
  }
}

/**
 * SSD-03: PO approval — the user who approves / receives a Purchase Order
 * must not be the same user who created it (created_by on purchase_order).
 *
 * Resolves the created_by of the PO from req.params.id.
 */
export async function getPoRaiser(
  req: MedusaRequest
): Promise<string | null> {
  try {
    const poId = req.params.id
    if (!poId) return null

    const inventoryBatchService = req.scope.resolve(
      INVENTORY_BATCH_MODULE
    ) as any

    const [po] = await inventoryBatchService.listPurchaseOrders(
      { id: poId },
      { select: ["created_by"] }
    )

    return po?.created_by ?? null
  } catch (err: any) {
    const logger = req.scope.resolve("logger") as any
    logger.warn(
      `[ssd] getPoRaiser failed: ${err.message}. Returning null.`
    )
    return null
  }
}

/**
 * SSD-04: Refund approval — the finance admin who approves a refund must
 * not be the same user who raised it (raised_by on pharma_refund).
 *
 * Resolves the raised_by of the PharmaRefund from req.params.id.
 */
export async function getRefundRaiser(
  req: MedusaRequest
): Promise<string | null> {
  try {
    const refundId = req.params.id
    if (!refundId) return null

    const paymentService = req.scope.resolve(PAYMENT_MODULE) as any

    const [refund] = await paymentService.listPharmaRefunds(
      { id: refundId },
      { select: ["raised_by"] }
    )

    return refund?.raised_by ?? null
  } catch (err: any) {
    const logger = req.scope.resolve("logger") as any
    logger.warn(
      `[ssd] getRefundRaiser failed: ${err.message}. Returning null.`
    )
    return null
  }
}
