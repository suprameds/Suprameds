import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import { PRESCRIPTION_MODULE } from "../../../../modules/prescription"
import { createLogger } from "../../../../lib/logger"

const logger = createLogger("admin:prescriptions:backfill")

/**
 * POST /admin/prescriptions/backfill
 *
 * Retroactively links prescriptions to orders that are missing the link.
 * For each order without a prescription link, checks:
 *   1. order.metadata.prescription_id
 *   2. cart.metadata.prescription_id (via order_cart link)
 * If found, creates the order↔prescription link.
 *
 * Returns a summary of what was linked.
 */
export async function POST(req: MedusaRequest, res: MedusaResponse) {
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY) as any
  const pgConnection = req.scope.resolve(ContainerRegistrationKeys.PG_CONNECTION) as any
  const prescriptionService = req.scope.resolve(PRESCRIPTION_MODULE) as any
  const cartService = req.scope.resolve(Modules.CART) as any
  const linkService = req.scope.resolve(ContainerRegistrationKeys.LINK) as any
  const orderService = req.scope.resolve(Modules.ORDER) as any

  const results: any[] = []

  try {
    // Get all orders
    const orders = await orderService.listOrders(
      {},
      { select: ["id", "display_id", "metadata"], take: null, order: { created_at: "ASC" } }
    )

    for (const order of orders) {
      const orderId = order.id
      const displayId = order.display_id

      // Check if link already exists
      try {
        const { rows: existingLinks } = await pgConnection.raw(
          `SELECT prescription_id FROM order_order_pharmaprescription_prescription WHERE order_id = ? AND deleted_at IS NULL`,
          [orderId]
        )
        if (existingLinks?.length > 0) {
          results.push({ display_id: displayId, status: "already_linked", prescription_id: existingLinks[0].prescription_id })
          continue
        }
      } catch {
        // Link table query failed — continue
      }

      // Check order.metadata.prescription_id
      let prescriptionId = (order.metadata as any)?.prescription_id

      // Fallback: check cart metadata via order_cart link
      if (!prescriptionId) {
        try {
          const { data: orderCartLink } = await query.graph({
            entity: "order_cart",
            fields: ["cart_id"],
            filters: { order_id: orderId },
          })
          const cartId = Array.isArray(orderCartLink)
            ? orderCartLink[0]?.cart_id
            : orderCartLink?.cart_id

          if (cartId) {
            const cart = await cartService.retrieveCart(cartId)
            prescriptionId = (cart?.metadata as any)?.prescription_id
          }
        } catch (err: any) {
          logger.warn(`Order ${displayId}: cart lookup failed: ${err.message}`)
        }
      }

      if (!prescriptionId) {
        results.push({ display_id: displayId, status: "no_prescription_found" })
        continue
      }

      // Verify prescription exists
      const [rx] = await prescriptionService.listPrescriptions(
        { id: prescriptionId },
        { take: 1 }
      )

      if (!rx) {
        results.push({ display_id: displayId, status: "prescription_not_found", prescription_id: prescriptionId })
        continue
      }

      // Create the link
      try {
        await linkService.create({
          [Modules.ORDER]: { order_id: orderId },
          [PRESCRIPTION_MODULE]: { prescription_id: prescriptionId },
        })
        results.push({ display_id: displayId, status: "linked", prescription_id: prescriptionId })
        logger.info(`Backfill: linked prescription ${prescriptionId} to order #${displayId}`)
      } catch (err: any) {
        results.push({ display_id: displayId, status: "link_failed", error: err.message })
      }
    }

    const linked = results.filter(r => r.status === "linked").length
    const alreadyLinked = results.filter(r => r.status === "already_linked").length
    const noRx = results.filter(r => r.status === "no_prescription_found").length

    return res.json({
      summary: { total: results.length, linked, already_linked: alreadyLinked, no_prescription: noRx },
      details: results,
    })
  } catch (err: any) {
    logger.error(`Backfill failed: ${err.message}`)
    return res.status(500).json({ error: err.message })
  }
}
