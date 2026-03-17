import { model } from "@medusajs/framework/utils"

/**
 * CodOrder — extended tracking for Cash on Delivery orders.
 * COD available for OTC only (Rx drugs require prepaid).
 * Orders > ₹500 require CS confirmation call.
 */
const CodOrder = model.define("cod_order", {
  id: model.id().primaryKey(),

  order_id: model.text(),
  cod_amount: model.number(),

  // COD fee shown transparently at checkout (₹49 default)
  surcharge_amount: model.number(),

  // True if order > ₹500
  confirmation_required: model.boolean().default(false),

  // Status flow: pending_confirmation → confirmed → dispatched → delivered_collected | rto | cancelled
  status: model.enum([
    "pending_confirmation",
    "confirmed",
    "dispatched",
    "delivered_collected",
    "rto",
    "cancelled",
  ]).default("pending_confirmation"),

  metadata: model.json().nullable(),
})

export default CodOrder
