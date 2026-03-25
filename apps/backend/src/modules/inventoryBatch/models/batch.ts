import { model } from "@medusajs/framework/utils"
import BatchDeduction from "./batch-deduction"

/**
 * Batch — represents a physical lot of a product received from a supplier.
 *
 * FEFO (First Expiry First Out) allocation is enforced by sorting on expiry_date ASC.
 * Index: idx_inventory_batches_fefo on (product_variant_id, expiry_date, available_quantity)
 *
 * Status transitions:
 *   active    — available for sale
 *   quarantine — held pending quality check
 *   recalled  — product recall issued (blocks sale, triggers notifications)
 *   expired   — past expiry_date (blocked from sale by scheduled job)
 *   depleted  — available_quantity = 0
 */
const Batch = model.define("batch", {
  id: model.id().primaryKey(),

  // Medusa product variant ID
  product_variant_id: model.text(),

  // Medusa product ID (denormalized)
  product_id: model.text(),

  // Manufacturer batch/lot number (printed on packaging)
  lot_number: model.text(),

  // Manufacturing date
  manufactured_on: model.dateTime().nullable(),

  // Expiry date — critical for FEFO allocation
  expiry_date: model.dateTime(),

  // Total units received in this batch
  received_quantity: model.number(),

  // Units currently available for allocation
  available_quantity: model.number(),

  // Units currently reserved (in active carts/pending orders)
  reserved_quantity: model.number().default(0),

  // MRP on this batch's packaging (in paise — ₹1 = 100 paise)
  batch_mrp_paise: model.bigNumber().nullable(),

  // Purchase price paid to supplier (in paise)
  purchase_price_paise: model.bigNumber().nullable(),

  // Stock location ID (Medusa built-in)
  location_id: model.text().nullable(),

  // Supplier / Purchase Order reference
  supplier_name: model.text().nullable(),
  purchase_order_ref: model.text().nullable(),

  // GRN (Goods Receipt Note) number
  grn_number: model.text().nullable(),

  // Date received at warehouse
  received_on: model.dateTime().nullable(),

  // Status
  status: model
    .enum(["active", "quarantine", "recalled", "expired", "depleted"])
    .default("active"),

  // Recall details
  recall_reason: model.text().nullable(),
  recalled_on: model.dateTime().nullable(),

  // Optimistic lock — incremented on every quantity mutation.
  // Callers must read version, then update with WHERE version = :read,
  // retrying on conflict.
  version: model.number().default(0),

  // Batch deductions (linked to order line items)
  deductions: model.hasMany(() => BatchDeduction, {
    mappedBy: "batch",
  }),

  metadata: model.json().nullable(),
})

export default Batch
