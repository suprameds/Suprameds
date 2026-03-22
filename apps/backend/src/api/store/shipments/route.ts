import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys, MedusaError } from "@medusajs/framework/utils"
import { SHIPMENT_MODULE } from "../../../modules/shipment"

const LOG = "[store:shipments]"

/**
 * GET /store/shipments?order_id=order_01...
 *
 * Returns shipment tracking info for a customer's order.
 * Auth: customer must be authenticated (enforced via middleware).
 */
export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const orderId = req.query.order_id as string

  if (!orderId) {
    throw new MedusaError(
      MedusaError.Types.INVALID_DATA,
      "order_id query parameter is required"
    )
  }

  const shipmentService = req.scope.resolve(SHIPMENT_MODULE) as any
  const logger = req.scope.resolve(ContainerRegistrationKeys.LOGGER) as any

  try {
    const shipments = await shipmentService.listShipments(
      { order_id: orderId },
      { order: { created_at: "DESC" } }
    )

    // Return a sanitized view — no internal IDs or warehouse details
    const trackingData = (shipments as any[]).map((s: any) => ({
      id: s.id,
      shipment_number: s.shipment_number,
      carrier: s.carrier,
      service_type: s.service_type,
      awb_number: s.awb_number,
      status: s.status,
      dispatched_at: s.dispatched_at,
      estimated_delivery: s.estimated_delivery,
      actual_delivery: s.actual_delivery,
      last_location: s.last_location,
      delivery_attempts: s.delivery_attempts,
      is_cod: s.is_cod,
      cod_amount: s.cod_amount,
      delivered_to: s.delivered_to,
    }))

    return res.json({ shipments: trackingData })
  } catch (err: any) {
    logger.error(`${LOG} Failed to fetch shipments for order ${orderId}: ${err?.message}`)
    return res.status(500).json({ message: "Failed to fetch tracking information" })
  }
}
