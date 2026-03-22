import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { PAYMENT_MODULE } from "../../../../modules/payment"

const LOG_PREFIX = "[invoice]"

/**
 * GET /admin/invoices/:id
 * Retrieve a supply memo by its ID.
 */
export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const logger = req.scope.resolve(ContainerRegistrationKeys.LOGGER) as any
  const { id } = req.params

  try {
    const paymentService = req.scope.resolve(PAYMENT_MODULE) as any
    const supplyMemo = await paymentService.retrieveSupplyMemo(id)

    return res.json({ supply_memo: supplyMemo })
  } catch (err: any) {
    logger.error(`${LOG_PREFIX} Could not retrieve supply memo ${id}: ${err?.message}`)
    return res
      .status(404)
      .json({ message: `Supply memo ${id} not found` })
  }
}
