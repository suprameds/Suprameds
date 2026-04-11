import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import { COD_MODULE } from "../../../../../modules/cod"

/**
 * POST /admin/pharma/cod/reconcile
 * Bulk reconcile COD payments from India Post monthly report.
 * Body: { orders: [{ order_id, amount_collected?, collection_date? }] }
 */
export async function POST(req: MedusaRequest, res: MedusaResponse) {
  const logger = req.scope.resolve(ContainerRegistrationKeys.LOGGER) as any
  const body = req.body as {
    orders: Array<{
      order_id: string
      amount_collected?: number
      collection_date?: string
    }>
  }

  if (!body.orders?.length) {
    return res.status(400).json({ message: "orders array is required" })
  }

  const codService = req.scope.resolve(COD_MODULE) as any
  const paymentModule = req.scope.resolve(Modules.PAYMENT) as any
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)

  const results = {
    processed: 0,
    skipped: 0,
    errors: 0,
    details: [] as any[],
  }

  for (const item of body.orders) {
    try {
      const [codOrder] = await codService.listCodOrders(
        { order_id: item.order_id },
        { take: 1 }
      )

      if (!codOrder) {
        results.skipped++
        results.details.push({ order_id: item.order_id, status: "not_found" })
        continue
      }

      if (codOrder.status === "delivered_collected") {
        results.skipped++
        results.details.push({
          order_id: item.order_id,
          status: "already_collected",
        })
        continue
      }

      // Update COD status
      await codService.updateCodOrders({
        id: codOrder.id,
        status: "delivered_collected",
        metadata: {
          ...(codOrder.metadata || {}),
          collected_at: item.collection_date || new Date().toISOString(),
          amount_collected: item.amount_collected || codOrder.cod_amount,
          reconciled: true,
        },
      })

      // Capture payment
      try {
        const {
          data: [order],
        } = (await query.graph({
          entity: "order",
          fields: ["payment_collection.payments.*"],
          filters: { id: item.order_id },
        })) as any

        const payments = order?.payment_collection?.payments || []
        for (const p of payments) {
          if (!p.captured_at) {
            await paymentModule.capturePayment({ payment_id: p.id })
          }
        }
      } catch {
        /* non-fatal */
      }

      results.processed++
      results.details.push({ order_id: item.order_id, status: "collected" })
    } catch (err: any) {
      results.errors++
      results.details.push({
        order_id: item.order_id,
        status: "error",
        message: err.message,
      })
    }
  }

  logger.info(
    `COD reconciliation: ${results.processed} processed, ${results.skipped} skipped, ${results.errors} errors`
  )
  return res.json(results)
}
