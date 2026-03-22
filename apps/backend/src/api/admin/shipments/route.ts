import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import { SHIPMENT_MODULE } from "../../../modules/shipment"
import { createTracking } from "../../../lib/aftership"

/**
 * GET /admin/shipments
 * List shipments with optional filters: order_id, status, awb_number.
 */
export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const shipmentService = req.scope.resolve(SHIPMENT_MODULE) as any

  const filters: Record<string, any> = {}

  if (req.query.order_id) {
    filters.order_id = req.query.order_id as string
  }
  if (req.query.status) {
    filters.status = req.query.status as string
  }
  if (req.query.awb_number) {
    filters.awb_number = req.query.awb_number as string
  }

  const shipments = await shipmentService.listShipments(filters, {
    order: { created_at: "DESC" },
  })

  return res.json({ shipments })
}

/**
 * POST /admin/shipments
 * Create a new shipment when admin dispatches an order.
 *
 * Body: { order_id, awb_number, warehouse_id?, contains_rx_drug?, is_cod?,
 *         cod_amount?, items?[] }
 */
export async function POST(req: MedusaRequest, res: MedusaResponse) {
  const shipmentService = req.scope.resolve(SHIPMENT_MODULE) as any
  const orderService = req.scope.resolve(Modules.ORDER) as any
  const eventBus = req.scope.resolve(Modules.EVENT_BUS) as any
  const logger = req.scope.resolve(ContainerRegistrationKeys.LOGGER) as any
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)

  const body = req.body as Record<string, any>

  if (!body.order_id) {
    return res.status(400).json({ message: "order_id is required" })
  }
  if (!body.awb_number) {
    return res.status(400).json({ message: "awb_number is required" })
  }

  try {
    // 1. Generate shipment number: SHP-YYYY-XXXXXX
    const year = new Date().getFullYear()
    const random6 = String(Math.floor(100_000 + Math.random() * 900_000))
    const shipmentNumber = `SHP-${year}-${random6}`

    // 2. Resolve order + customer details for AfterShip registration
    let customerName: string | undefined
    let customerPhone: string | undefined
    let customerEmail: string | undefined
    let destinationCity: string | undefined

    try {
      const { data: orders } = await query.graph({
        entity: "order",
        fields: [
          "id",
          "display_id",
          "customer.first_name",
          "customer.last_name",
          "customer.email",
          "customer.phone",
          "shipping_address.city",
          "shipping_address.first_name",
          "shipping_address.last_name",
          "shipping_address.phone",
        ],
        filters: { id: body.order_id },
      })

      const order = (orders as any[])?.[0]
      if (order) {
        const addr = order.shipping_address
        const cust = order.customer

        customerName = addr?.first_name
          ? `${addr.first_name} ${addr.last_name ?? ""}`.trim()
          : cust?.first_name
            ? `${cust.first_name} ${cust.last_name ?? ""}`.trim()
            : undefined

        customerPhone = addr?.phone || cust?.phone || undefined
        customerEmail = cust?.email || undefined
        destinationCity = addr?.city || undefined
      }
    } catch (orderErr: any) {
      logger.warn(
        `[shipments] Could not resolve order details for ${body.order_id}: ${orderErr?.message}`
      )
    }

    // 3. Create the Shipment record
    const shipment = await shipmentService.createShipments({
      order_id: body.order_id,
      shipment_number: shipmentNumber,
      awb_number: body.awb_number,
      warehouse_id: body.warehouse_id || "default",
      dispatched_at: new Date(),
      contains_rx_drug: body.contains_rx_drug ?? false,
      is_cod: body.is_cod ?? false,
      cod_amount: body.cod_amount ?? 0,
      status: "label_created",
    })

    // 4. Create ShipmentItem records if items provided
    if (Array.isArray(body.items) && body.items.length > 0) {
      for (const item of body.items) {
        await shipmentService.createShipmentItems({
          shipment_id: shipment.id,
          order_item_id: item.order_item_id,
          batch_id: item.batch_id,
          quantity_shipped: item.quantity_shipped,
          batch_number: item.batch_number,
          expiry_date: item.expiry_date,
        })
      }
    }

    // 5. Register with AfterShip (non-blocking — don't fail shipment on tracking errors)
    try {
      const tracking = await createTracking({
        awb_number: body.awb_number,
        order_id: body.order_id,
        customer_name: customerName,
        customer_phone: customerPhone,
        customer_email: customerEmail,
        destination_city: destinationCity,
      })

      // 6. Persist AfterShip tracking_id if returned
      if (tracking?.tracking_id) {
        await shipmentService.updateShipments({
          id: shipment.id,
          aftership_tracking_id: tracking.tracking_id,
        })
        shipment.aftership_tracking_id = tracking.tracking_id
        logger.info(
          `[shipments] AfterShip tracking created for ${shipmentNumber}: ${tracking.tracking_id}`
        )
      }
    } catch (aftershipErr: any) {
      logger.warn(
        `[shipments] AfterShip registration failed for ${shipmentNumber} (non-fatal): ${aftershipErr?.message}`
      )
    }

    // 7. Emit order.dispatched event for push notification subscriber
    try {
      await eventBus.emit({
        name: "order.dispatched",
        data: { order_id: body.order_id },
      })
    } catch (evtErr: any) {
      logger.warn(
        `[shipments] Failed to emit order.dispatched event: ${evtErr?.message}`
      )
    }

    // 8. Return created shipment
    return res.status(201).json({ shipment })
  } catch (err: any) {
    logger.error(`[shipments] Failed to create shipment: ${err?.message}`)
    return res
      .status(400)
      .json({ message: err?.message || "Failed to create shipment" })
  }
}
