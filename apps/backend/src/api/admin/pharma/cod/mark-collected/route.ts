import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import { COD_MODULE } from "../../../../../modules/cod"

/**
 * POST /admin/pharma/cod/mark-collected
 * Marks a COD order's payment as collected (India Post delivered & collected cash).
 * Body: { order_id: string, amount_collected?: number, collection_date?: string }
 */
export async function POST(req: MedusaRequest, res: MedusaResponse) {
  const logger = req.scope.resolve(ContainerRegistrationKeys.LOGGER) as any
  const body = req.body as {
    order_id: string
    amount_collected?: number
    collection_date?: string
  }

  if (!body.order_id) {
    return res.status(400).json({ message: "order_id is required" })
  }

  try {
    // Update COD order status
    const codService = req.scope.resolve(COD_MODULE) as any
    const [codOrder] = await codService.listCodOrders(
      { order_id: body.order_id },
      { take: 1 }
    )

    if (!codOrder) {
      return res.status(404).json({ message: "COD order not found" })
    }

    await codService.updateCodOrders({
      id: codOrder.id,
      status: "delivered_collected",
      metadata: {
        ...(codOrder.metadata || {}),
        collected_at: body.collection_date || new Date().toISOString(),
        amount_collected: body.amount_collected || codOrder.cod_amount,
      },
    })

    // Capture the payment in Medusa's payment system
    try {
      const paymentModule = req.scope.resolve(Modules.PAYMENT) as any
      const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)

      const {
        data: [order],
      } = (await query.graph({
        entity: "order",
        fields: ["payment_collection.payments.*"],
        filters: { id: body.order_id },
      })) as any

      const payments = order?.payment_collection?.payments || []
      for (const payment of payments) {
        if (payment.captured_at == null) {
          try {
            await paymentModule.capturePayment({ payment_id: payment.id })
            logger.info(
              `Captured COD payment ${payment.id} for order ${body.order_id}`
            )
          } catch (captureErr: any) {
            logger.warn(`Payment capture failed: ${captureErr.message}`)
          }
        }
      }
    } catch (payErr: any) {
      logger.warn(`Payment module error: ${payErr.message}`)
    }

    logger.info(
      `COD payment marked as collected for order ${body.order_id}`
    )
    return res.json({ success: true, status: "delivered_collected" })
  } catch (err: any) {
    logger.error(`COD mark-collected failed: ${err.message}`)
    return res.status(500).json({ message: err.message })
  }
}
