import { model } from "@medusajs/framework/utils"

/**
 * OrderExtension — extends Medusa order with pharma-specific fields.
 * Linked to Medusa's order entity via module links.
 * 14-state order state machine for Indian pharmacy compliance.
 */
const OrderExtension = model.define("order_extension", {
  id: model.id().primaryKey(),

  order_id: model.text().unique(),

  // Rx flags
  is_rx_order: model.boolean().default(false),
  is_guest_order: model.boolean().default(false),
  is_cs_placed: model.boolean().default(false),
  cs_agent_id: model.text().nullable(),
  prescription_id: model.text().nullable(),

  // Partial Rx approval
  is_partial_approval: model.boolean().default(false),
  payment_authorized_amount: model.number().default(0),
  payment_captured_amount: model.number().default(0),
  payment_released_amount: model.number().default(0),

  // COD
  is_cod: model.boolean().default(false),
  cod_amount: model.number().default(0),
  cod_confirmation_status: model.enum([
    "not_required",
    "pending",
    "confirmed",
    "auto_cancelled",
  ]).nullable(),
  cod_confirmed_at: model.dateTime().nullable(),
  cod_confirmed_by: model.text().nullable(),
  cod_attempts: model.number().default(0),

  // Partial shipment
  partial_shipment_preference: model.enum([
    "all_or_nothing",
    "ship_available",
    "customer_choice",
  ]).default("all_or_nothing"),

  // 14-state order status
  status: model.enum([
    "pending_cod_confirmation",
    "pending_rx_review",
    "partially_approved",
    "fully_approved",
    "payment_captured",
    "allocation_pending",
    "pick_pending",
    "packing",
    "pending_dispatch_approval",
    "dispatched",
    "delivered",
    "partially_fulfilled",
    "cancelled",
    "refunded",
  ]).default("pending_rx_review"),

  cancellation_reason: model.text().nullable(),

  // B2B invoicing — optional GSTIN provided by customer during checkout
  gstin: model.text().nullable(),

  metadata: model.json().nullable(),
})

export default OrderExtension
