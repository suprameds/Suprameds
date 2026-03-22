import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { MedusaError } from "@medusajs/framework/utils"
import { COD_MODULE } from "../../../../modules/cod"
import { ConfirmCodWorkflow } from "../../../../workflows/order/confirm-cod"

/**
 * GET /store/orders/cod-confirm?order_id=xxx
 * Returns the COD confirmation status for a given order.
 */
export const GET = async (req: MedusaRequest, res: MedusaResponse) => {
  const { order_id } = req.query as { order_id?: string }

  if (!order_id) {
    throw new MedusaError(
      MedusaError.Types.INVALID_DATA,
      "Query param 'order_id' is required"
    )
  }

  const codService = req.scope.resolve(COD_MODULE) as any

  const [codOrder] = await codService.listCodOrders(
    { order_id },
    { take: 1 }
  )

  if (!codOrder) {
    throw new MedusaError(
      MedusaError.Types.NOT_FOUND,
      `No COD record found for order ${order_id}`
    )
  }

  res.json({
    cod_order: {
      id: codOrder.id,
      order_id: codOrder.order_id,
      status: codOrder.status,
      cod_amount: codOrder.cod_amount,
      surcharge_amount: codOrder.surcharge_amount,
      confirmation_required: codOrder.confirmation_required,
      confirmed_at: codOrder.confirmed_at,
      phone_verified: codOrder.phone_verified,
      confirmation_attempts: codOrder.confirmation_attempts,
    },
  })
}

/**
 * POST /store/orders/cod-confirm
 * Body: { order_id: string, confirmed: boolean }
 *
 * Customer confirms or declines a COD order.
 * Runs the ConfirmCodWorkflow which handles status transitions,
 * order extension updates, and event emission.
 */
export const POST = async (req: MedusaRequest, res: MedusaResponse) => {
  const { order_id, confirmed } = req.body as {
    order_id?: string
    confirmed?: boolean
  }

  if (!order_id) {
    throw new MedusaError(
      MedusaError.Types.INVALID_DATA,
      "Field 'order_id' is required"
    )
  }

  if (typeof confirmed !== "boolean") {
    throw new MedusaError(
      MedusaError.Types.INVALID_DATA,
      "Field 'confirmed' must be a boolean"
    )
  }

  const { result } = await ConfirmCodWorkflow(req.scope).run({
    input: {
      order_id,
      confirmed,
      phone_verified: false,
    },
  })

  res.json(result)
}
