import { model } from "@medusajs/framework/utils"

/**
 * PaymentRecord — payment tracking for Paytm/Razorpay/Stripe/COD.
 * Supports auth → capture split for partial Rx approvals.
 */
const PaymentRecord = model.define("payment_record", {
  id: model.id().primaryKey(),

  order_id: model.text(),

  // paytm | razorpay | stripe | cod
  gateway: model.enum(["paytm", "razorpay", "stripe", "cod"]),

  // null for COD
  gateway_payment_id: model.text().nullable(),

  // upi | card | netbanking | emi | cod | payment_link
  payment_method: model.enum([
    "upi",
    "card",
    "netbanking",
    "emi",
    "cod",
    "payment_link",
  ]),

  authorized_amount: model.number().default(0),
  captured_amount: model.number().default(0),
  released_amount: model.number().default(0),
  refunded_amount: model.number().default(0),

  status: model.enum([
    "authorized",
    "partially_captured",
    "fully_captured",
    "partially_refunded",
    "fully_refunded",
    "failed",
    "voided",
    "cod_pending",
  ]).default("authorized"),

  captured_at: model.dateTime().nullable(),

  metadata: model.json().nullable(),
})

export default PaymentRecord
