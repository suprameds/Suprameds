import { model } from "@medusajs/framework/utils"
import PurchaseOrder from "./purchase-order"

/**
 * PurchaseOrderLine — one line item in a purchase order.
 *
 * Each line represents a specific product+batch being purchased.
 * On receipt, a Batch record is auto-created from this line.
 */
const PurchaseOrderLine = model.define("purchase_order_line", {
  id: model.id().primaryKey(),

  purchase_order: model.belongsTo(() => PurchaseOrder, {
    mappedBy: "lines",
  }),

  // Medusa product references
  product_id: model.text(),
  product_variant_id: model.text(),

  // Denormalized for display in admin tables
  product_name: model.text(),

  // Batch details (filled at PO creation)
  lot_number: model.text(),
  expiry_date: model.dateTime(),
  manufactured_on: model.dateTime().nullable(),

  // Quantities
  ordered_quantity: model.number(),
  received_quantity: model.number().default(0),

  // Pricing per unit (in paise)
  mrp_paise: model.bigNumber().nullable(),
  purchase_price_paise: model.bigNumber(),

  // Line total (computed: ordered_quantity * purchase_price_paise)
  line_total_paise: model.bigNumber().default(0),

  // Reference to the Batch created when this line is received
  batch_id: model.text().nullable(),

  // Per-line status for partial receipts
  line_status: model
    .enum(["pending", "received", "partial", "rejected"])
    .default("pending"),

  rejection_reason: model.text().nullable(),

  metadata: model.json().nullable(),
})

export default PurchaseOrderLine
