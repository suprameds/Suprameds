import { model } from "@medusajs/framework/utils"

/**
 * Refund — SSD enforced: support_agent raises, finance_admin approves.
 */
const Refund = model.define("refund", {
  id: model.id().primaryKey(),

  payment_id: model.text(),
  order_id: model.text(),

  // FK → users (support_agent)
  raised_by: model.text(),

  // FK → users (finance_admin) — SSD: must differ from raised_by
  approved_by: model.text().nullable(),

  reason: model.enum([
    "rejected_rx_line",
    "cancelled_order",
    "return",
    "batch_recall",
    "payment_capture_error",
    "cod_non_delivery",
    "other",
  ]),

  amount: model.number(),

  status: model.enum([
    "pending_approval",
    "approved",
    "rejected",
    "processed",
  ]).default("pending_approval"),

  gateway_refund_id: model.text().nullable(),

  processed_at: model.dateTime().nullable(),

  metadata: model.json().nullable(),
})

export default Refund
