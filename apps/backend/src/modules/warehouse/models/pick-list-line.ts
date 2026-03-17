import { model } from "@medusajs/framework/utils"

/**
 * PickListLine — individual pick instructions from FEFO allocation.
 */
const PickListLine = model.define("pick_list_line", {
  id: model.id().primaryKey(),
  task_id: model.text(),
  order_item_id: model.text(),
  allocation_id: model.text(),
  batch_id: model.text(),
  bin_id: model.text(),
  quantity_to_pick: model.number(),
  quantity_picked: model.number().default(0),
  status: model.enum(["pending", "picked", "short_pick", "exception"]).default("pending"),
  picked_by: model.text().nullable(),
  picked_at: model.dateTime().nullable(),
  exception_reason: model.text().nullable(),
})

export default PickListLine
