import { model } from "@medusajs/framework/utils"
import PurchaseOrderLine from "./purchase-order-line"

/**
 * PurchaseOrder — represents a stock purchase from a supplier.
 *
 * Workflow:
 *   draft     → Created, lines being added
 *   ordered   → Sent to supplier, awaiting delivery
 *   received  → Goods received, batches auto-created
 *   partial   → Some lines received, some pending
 *   cancelled → PO cancelled
 */
const PurchaseOrder = model.define("purchase_order", {
  id: model.id().primaryKey(),

  // Sequential PO number (e.g. PO-2026-001)
  po_number: model.text(),

  supplier_name: model.text(),
  supplier_contact: model.text().nullable(),
  supplier_invoice_number: model.text().nullable(),

  // Dates
  order_date: model.dateTime(),
  expected_delivery_date: model.dateTime().nullable(),
  received_date: model.dateTime().nullable(),

  status: model
    .enum(["draft", "ordered", "received", "partial", "cancelled"])
    .default("draft"),

  // GRN number assigned on receipt
  grn_number: model.text().nullable(),

  // Stock location where goods will be received
  location_id: model.text().nullable(),

  notes: model.text().nullable(),

  // Totals (computed on save, in paise)
  total_items: model.number().default(0),
  total_quantity: model.number().default(0),
  total_cost_paise: model.bigNumber().default(0),

  // Who created/received
  created_by: model.text().nullable(),
  received_by: model.text().nullable(),

  lines: model.hasMany(() => PurchaseOrderLine, {
    mappedBy: "purchase_order",
  }),

  metadata: model.json().nullable(),
})

export default PurchaseOrder
