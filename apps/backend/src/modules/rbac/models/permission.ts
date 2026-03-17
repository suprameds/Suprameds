import { model } from "@medusajs/framework/utils"

/**
 * Permission — granular resource + action permissions.
 */
const Permission = model.define("permission", {
  id: model.id().primaryKey(),
  resource: model.text(),
  action: model.text(),
  description: model.text().nullable(),
})

export default Permission
