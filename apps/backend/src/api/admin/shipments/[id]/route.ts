import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys, MedusaError } from "@medusajs/framework/utils"
import { SHIPMENT_MODULE } from "../../../../modules/shipment"

/**
 * GET /admin/shipments/:id
 * Retrieve a single shipment with all related details.
 */
export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const { id } = req.params
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)

  const { data: shipments } = await query.graph({
    entity: "shipment",
    fields: [
      "id",
      "order_id",
      "shipment_number",
      "carrier",
      "service_type",
      "awb_number",
      "aftership_tracking_id",
      "warehouse_id",
      "dispatched_at",
      "dispatched_by",
      "contains_rx_drug",
      "estimated_delivery",
      "actual_delivery",
      "delivery_attempts",
      "delivery_otp",
      "delivery_otp_verified",
      "delivery_photo_url",
      "delivered_to",
      "status",
      "last_location",
      "ndr_reason",
      "ndr_action",
      "is_cod",
      "cod_amount",
      "cod_collected",
      "metadata",
      "created_at",
      "updated_at",
      "shipment_items.*",
    ],
    filters: { id },
  })

  if (!shipments.length) {
    throw new MedusaError(
      MedusaError.Types.NOT_FOUND,
      `Shipment ${id} not found`
    )
  }

  return res.json({ shipment: shipments[0] })
}

/**
 * POST /admin/shipments/:id
 * Update shipment fields (status, awb_number, last_location, ndr fields, etc.).
 */
export async function POST(req: MedusaRequest, res: MedusaResponse) {
  const { id } = req.params
  const shipmentService = req.scope.resolve(SHIPMENT_MODULE) as any
  const logger = req.scope.resolve(ContainerRegistrationKeys.LOGGER) as any
  const body = req.body as Record<string, any>

  // Allowlisted fields that admin can update
  const UPDATABLE_FIELDS = [
    "status",
    "awb_number",
    "last_location",
    "ndr_reason",
    "ndr_action",
    "estimated_delivery",
    "actual_delivery",
    "delivery_attempts",
    "delivery_otp_verified",
    "delivery_photo_url",
    "delivered_to",
    "dispatched_by",
    "is_cod",
    "cod_amount",
    "cod_collected",
    "metadata",
  ] as const

  try {
    // Verify shipment exists
    const existing = await shipmentService.retrieveShipment(id)
    if (!existing) {
      throw new MedusaError(
        MedusaError.Types.NOT_FOUND,
        `Shipment ${id} not found`
      )
    }

    // Build update payload from allowlisted fields only
    const updateData: Record<string, any> = { id }
    for (const field of UPDATABLE_FIELDS) {
      if (body[field] !== undefined) {
        updateData[field] = body[field]
      }
    }

    const shipment = await shipmentService.updateShipments(updateData)

    logger.info(
      `[shipments] Updated shipment ${id} — fields: ${Object.keys(updateData).filter((k) => k !== "id").join(", ")}`
    )

    return res.json({ shipment })
  } catch (err: any) {
    if (err instanceof MedusaError) {
      throw err
    }
    logger.error(`[shipments] Failed to update shipment ${id}: ${err?.message}`)
    return res
      .status(400)
      .json({ message: err?.message || "Failed to update shipment" })
  }
}
