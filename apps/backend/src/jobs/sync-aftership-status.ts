import { MedusaContainer } from "@medusajs/framework/types"
import { Modules } from "@medusajs/framework/utils"
import {
  getTrackingStatus,
  normalizeAfterShipStatus,
} from "../lib/aftership"
import { SHIPMENT_MODULE } from "../modules/shipment"

/** Terminal statuses that should not be polled again. */
const TERMINAL_STATUSES = ["delivered", "rto_delivered"]

/**
 * Fallback polling job — every 30 minutes.
 * Catches status changes that the webhook may have missed.
 */
export default async function SyncAftershipStatusJob(
  container: MedusaContainer
) {
  const logger = container.resolve("logger")
  const shipmentService = container.resolve(SHIPMENT_MODULE) as any
  const eventBus = container.resolve(Modules.EVENT_BUS) as any

  logger.info("[sync-aftership] Starting sync run")

  // Fetch all active (non-terminal) shipments that have an AWB
  const allShipments = await shipmentService.listShipments(
    {},
    { take: 500 }
  )
  const activeShipments = allShipments.filter(
    (s: any) =>
      s.awb_number && !TERMINAL_STATUSES.includes(s.status)
  )

  let synced = 0
  let changed = 0
  let errors = 0

  for (const shipment of activeShipments) {
    try {
      const slug = shipment.carrier ?? "india-post"
      const tracking = await getTrackingStatus(slug, shipment.awb_number)

      if (!tracking) continue
      synced++

      const newStatus = normalizeAfterShipStatus(tracking.tag, tracking.subtag)
      if (newStatus === shipment.status) continue

      const latestCheckpoint = tracking.checkpoints.length
        ? tracking.checkpoints[tracking.checkpoints.length - 1]
        : undefined

      const updateData: Record<string, unknown> = {
        id: shipment.id,
        status: newStatus,
        last_location: latestCheckpoint?.location ?? shipment.last_location,
      }

      if (newStatus === "delivered") {
        updateData.actual_delivery = new Date()
        updateData.delivered_to = tracking.signed_by ?? shipment.delivered_to
      }

      if (newStatus === "ndr") {
        updateData.ndr_reason = tracking.subtag ?? "unknown"
        updateData.delivery_attempts = (shipment.delivery_attempts ?? 0) + 1
      }

      await shipmentService.updateShipments(updateData)
      changed++

      logger.info(
        `[sync-aftership] Shipment ${shipment.id} ${shipment.status} → ${newStatus}`
      )

      // Emit domain events for status transitions
      if (newStatus === "delivered") {
        await eventBus.emit({
          name: "order.delivered",
          data: { id: shipment.order_id },
        })
      }

      if (newStatus === "ndr") {
        await eventBus.emit({
          name: "shipment.ndr_reported",
          data: {
            shipment_id: shipment.id,
            order_id: shipment.order_id,
            ndr_reason: tracking.subtag ?? "unknown",
          },
        })
      }

      if (tracking.subtag && tracking.subtag.toUpperCase().includes("RTO")) {
        await eventBus.emit({
          name: "shipment.rto_initiated",
          data: {
            shipment_id: shipment.id,
            order_id: shipment.order_id,
          },
        })
      }
    } catch (err: any) {
      errors++
      logger.error(
        `[sync-aftership] Failed to sync shipment ${shipment.id} (AWB: ${shipment.awb_number}): ${err.message}`
      )
    }
  }

  logger.info(
    `[sync-aftership] Synced ${synced} shipments, ${changed} status changes, ${errors} errors`
  )
}

export const config = {
  name: "sync-aftership",
  schedule: "*/30 * * * *",
}
