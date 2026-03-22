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

  // Timestamp when customer confirmed via IVR / SMS link / manual call
  confirmed_at: model.dateTime().nullable(),

  // Whether phone verification was done (IVR callback / OTP on call)
  phone_verified: model.boolean().default(false),

  // Customer phone used for confirmation call
  customer_phone: model.text().nullable(),

  // Number of confirmation attempts made by CS team
  confirmation_attempts: model.number().default(0),

  metadata: model.json().nullable(),
})

export default CodOrder
