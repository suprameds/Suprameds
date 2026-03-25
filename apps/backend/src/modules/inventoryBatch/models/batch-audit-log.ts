import { model } from "@medusajs/framework/utils"

/**
 * BatchAuditLog — immutable record of every mutation to a batch.
 *
 * Captures the actor, action, old/new values, and context (order, fulfillment).
 * Used for regulatory compliance (CDSCO traceability) and internal debugging.
 */
const BatchAuditLog = model.define("batch_audit_log", {
  id: model.id().primaryKey(),

  batch_id: model.text(),

  // Action type
  action: model
    .enum([
      "created",
      "qty_adjusted",
      "status_changed",
      "field_edited",
      "deduction_sale",
      "deduction_reversed",
      "deduction_return",
      "fulfillment_override",
    ])
    .default("field_edited"),

  // What changed — key-value snapshot of old and new values
  field_name: model.text().nullable(),
  old_value: model.text().nullable(),
  new_value: model.text().nullable(),

  // Who made the change
  actor_id: model.text().nullable(),
  actor_type: model
    .enum(["admin", "system", "job", "workflow"])
    .default("system"),

  // Context: which order/fulfillment triggered this
  order_id: model.text().nullable(),
  fulfillment_id: model.text().nullable(),

  reason: model.text().nullable(),

  metadata: model.json().nullable(),
})

export default BatchAuditLog
