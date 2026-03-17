import { model } from "@medusajs/framework/utils"

/**
 * PreDispatchSignOff — pharmacist verifies Rx orders before carrier booking.
 * Required for all orders containing scheduled drugs.
 */
const PreDispatchSignOff = model.define("pre_dispatch_sign_off", {
  id: model.id().primaryKey(),

  order_id: model.text(),
  pharmacist_id: model.text(),

  // Checklist as JSON
  checks_performed: model.json(),

  approved: model.boolean().default(false),
  rejection_reason: model.text().nullable(),

  signed_off_at: model.dateTime(),
})

export default PreDispatchSignOff
