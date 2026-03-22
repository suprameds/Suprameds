import { model } from "@medusajs/framework/utils"

/**
 * ServiceablePincode — India Post Office pincode serviceability data.
 * Imported from the official Post Office CSV.
 * Used for delivery serviceability checks at checkout.
 */
const ServiceablePincode = model.define("serviceable_pincode", {
  id: model.id().primaryKey(),
  pincode: model.text().index(),
  officename: model.text(),
  officetype: model.text().nullable(),
  delivery: model.text(),
  district: model.text(),
  statename: model.text(),
  divisionname: model.text().nullable(),
  regionname: model.text().nullable(),
  circlename: model.text().nullable(),
  latitude: model.text().nullable(),
  longitude: model.text().nullable(),
  is_serviceable: model.boolean().default(true),
})

export default ServiceablePincode
