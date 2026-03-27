import crypto from "crypto"
import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { Modules } from "@medusajs/framework/utils"
import { normalizeAfterShipStatus } from "../../../lib/aftership"
import { SHIPMENT_MODULE } from "../../../modules/shipment"

interface AfterShipCheckpoint {
  tag: string
  message: string
  location: string
  checkpoint_time: string
}

interface AfterShipMsg {
  id: string
  tracking_number: string
  slug: string
  tag: string
  subtag?: string
  custom_fields?: { order_id?: string }
  checkpoints?: AfterShipCheckpoint[]
  signed_by?: string
}

interface AfterShipPayload {
  event_id: string
  event: string
  msg: AfterShipMsg
}

/**
 * POST /webhooks/aftership
 *
 * AfterShip sends tracking updates here. We normalise the status,
 * persist it on the Shipment record, and emit domain events so
 * subscribers (push notifications, admin alerts) can react.
 */
export const POST = async (req: MedusaRequest, res: MedusaResponse) => {
  const logger = req.scope.resolve("logger")
  logger.info("[webhook:aftership] Received")

  // ── 1. Verify HMAC signature (required) ─────────────────────────
  const secret = process.env.AFTERSHIP_WEBHOOK_SECRET
  if (!secret) {
    logger.error("[webhook:aftership] AFTERSHIP_WEBHOOK_SECRET not configured — rejecting request")
    res.status(500).json({ error: "Webhook secret not configured" })
    return
  }

  const rawBody = JSON.stringify(req.body)
  const expected = crypto
    .createHmac("sha256", secret)
    .update(rawBody)
    .digest("hex")
  const signature = req.headers["hmac-sha256"] as string | undefined

  if (!signature || signature !== expected) {
    logger.warn("[webhook:aftership] Invalid HMAC signature — rejecting")
    res.status(401).json({ error: "Invalid signature" })
    return
  }

  // ── 2. Extract payload ──────────────────────────────────────────
  const { msg } = req.body as AfterShipPayload
  if (!msg) {
    logger.warn("[webhook:aftership] Missing msg in payload")
    res.status(200).json({ received: true })
    return
  }

  const status = normalizeAfterShipStatus(msg.tag, msg.subtag)
  const latestCheckpoint = msg.checkpoints?.length
    ? msg.checkpoints[msg.checkpoints.length - 1]
    : undefined

  // ── 3. Resolve service & find shipment ──────────────────────────
  const shipmentService = req.scope.resolve(SHIPMENT_MODULE) as any

  let shipments = await shipmentService.listShipments({
    aftership_tracking_id: msg.id,
  })

  if (!shipments.length) {
    shipments = await shipmentService.listShipments({
      awb_number: msg.tracking_number,
    })
  }

  if (!shipments.length) {
    logger.warn(
      `[webhook:aftership] No shipment found for aftership_id=${msg.id} awb=${msg.tracking_number}`
    )
    res.status(200).json({ received: true, matched: false })
    return
  }

  const shipment = shipments[0]

  // ── 4. Build update payload ─────────────────────────────────────
  const updateData: Record<string, unknown> = {
    id: shipment.id,
    status,
    last_location: latestCheckpoint?.location ?? shipment.last_location,
  }

  if (status === "delivered") {
    updateData.actual_delivery = new Date()
    updateData.delivered_to = msg.signed_by ?? shipment.delivered_to
  }

  if (status === "ndr") {
    updateData.ndr_reason = msg.subtag ?? "unknown"
    updateData.delivery_attempts = (shipment.delivery_attempts ?? 0) + 1
  }

  await shipmentService.updateShipments(updateData)

  logger.info(
    `[webhook:aftership] Shipment ${shipment.id} updated → ${status} (tag=${msg.tag}, subtag=${msg.subtag ?? "none"})`
  )

  // ── 5. Emit domain events ──────────────────────────────────────
  const eventBus = req.scope.resolve(Modules.EVENT_BUS) as any

  if (status === "delivered") {
    await eventBus.emit({
      name: "order.delivered",
      data: { id: shipment.order_id },
    })
  }

  if (status === "ndr") {
    await eventBus.emit({
      name: "shipment.ndr_reported",
      data: {
        shipment_id: shipment.id,
        order_id: shipment.order_id,
        ndr_reason: msg.subtag ?? "unknown",
      },
    })
  }

  if (msg.subtag && msg.subtag.toUpperCase().includes("RTO")) {
    await eventBus.emit({
      name: "shipment.rto_initiated",
      data: {
        shipment_id: shipment.id,
        order_id: shipment.order_id,
      },
    })
  }

  res.status(200).json({ received: true, status })
}
