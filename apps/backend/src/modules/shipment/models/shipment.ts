import { model } from "@medusajs/framework/utils"

/**
 * Shipment — tracking for India Post Speed Post deliveries.
 * AWB entered manually by staff after India Post handover.
 * AfterShip used for tracking status normalization.
 */
const Shipment = model.define("shipment", {
  id: model.id().primaryKey(),

  order_id: model.text(),

  // SHP-YYYY-XXXXXX (internal)
  shipment_number: model.text().unique(),

  // Always India Post — no selection needed
  carrier: model.text().default("india-post"),

  // Always Speed Post Pro
  service_type: model.text().default("speed-post"),

  // Speed Post article number (EU/EE/CP + 8 digits + IN)
  awb_number: model.text().nullable(),

  // AfterShip tracking record ID
  aftership_tracking_id: model.text().nullable(),

  // Dispatch details
  warehouse_id: model.text(),
  dispatched_at: model.dateTime().nullable(),
  dispatched_by: model.text().nullable(),

  // Delivery
  contains_rx_drug: model.boolean().default(false),
  estimated_delivery: model.dateTime().nullable(),
  actual_delivery: model.dateTime().nullable(),
  delivery_attempts: model.number().default(0),

  // OTP delivery (mandatory for Rx orders)
  delivery_otp: model.text().nullable(),
  delivery_otp_verified: model.boolean().default(false),
  delivery_photo_url: model.text().nullable(),
  delivered_to: model.text().nullable(),

  // AfterShip normalized status
  status: model.enum([
    "label_created",
    "in_transit",
    "out_for_delivery",
    "delivery_attempted",
    "delivered",
    "ndr",
    "rto_initiated",
    "rto_delivered",
  ]).default("label_created"),

  last_location: model.text().nullable(),

  // NDR
  ndr_reason: model.text().nullable(),
  ndr_action: model.enum(["reattempt", "rto"]).nullable(),

  // COD
  is_cod: model.boolean().default(false),
  cod_amount: model.number().default(0),
  cod_collected: model.boolean().default(false),

  metadata: model.json().nullable(),
})

export default Shipment
