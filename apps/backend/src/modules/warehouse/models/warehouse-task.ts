import { model } from "@medusajs/framework/utils"

/**
 * WarehouseTask — pick/pack/dispatch/receive/inspect tasks.
 */
const WarehouseTask = model.define("warehouse_task", {
  id: model.id().primaryKey(),
  task_type: model.enum([
    "receive",
    "inspect",
    "put_away",
    "pick",
    "pack",
    "pre_dispatch_check",
    "dispatch",
    "return_inspect",
    "cycle_count",
  ]),
  reference_type: model.text(),
  reference_id: model.text(),
  assigned_to: model.text().nullable(),
  warehouse_id: model.text(),
  priority: model.enum(["low", "normal", "high", "urgent"]).default("normal"),
  status: model.enum(["pending", "assigned", "in_progress", "completed", "exception"]).default("pending"),
  started_at: model.dateTime().nullable(),
  completed_at: model.dateTime().nullable(),
  exception_notes: model.text().nullable(),
})

export default WarehouseTask
