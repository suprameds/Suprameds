import { model } from "@medusajs/framework/utils"
import Prescription from "./prescription"

/**
 * PrescriptionLine — one drug entry from an approved prescription.
 * Created by pharmacist during review.
 *
 * Traceability: when an Rx drug is added to cart → at checkout the
 * system validates a PrescriptionLine exists for that product +
 * the parent Prescription is `approved` and not expired.
 */
const PrescriptionLine = model.define("prescription_line", {
  id: model.id().primaryKey(),

  prescription: model.belongsTo(() => Prescription, {
    mappedBy: "lines",
  }),

  // Medusa product variant ID
  product_variant_id: model.text(),

  // Medusa product ID (denormalized for faster queries)
  product_id: model.text(),

  // Approved quantity (units)
  approved_quantity: model.number().default(1),

  // How many units have already been dispensed across all orders
  dispensed_quantity: model.number().default(0),

  // Maximum refills allowed (null = no limit, governed by prescription)
  max_refills: model.number().nullable(),

  // Refill count used
  refills_used: model.number().default(0),

  metadata: model.json().nullable(),
})

export default PrescriptionLine
