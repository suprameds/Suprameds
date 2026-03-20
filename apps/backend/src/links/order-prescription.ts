import { defineLink } from "@medusajs/framework/utils"
import OrderModule from "@medusajs/medusa/order"
import PrescriptionModule from "../modules/prescription"

/**
 * Many-to-many style link: Order ↔ Prescription
 *
 * An order can have multiple prescriptions (multiple Rx drugs from different prescriptions).
 * A prescription can span multiple orders (refills).
 *
 * This uses a proper link table (not readOnly) because the relationship
 * is managed separately from the Prescription model.
 */
export default defineLink(
  {
    linkable: ((OrderModule as any)?.linkable?.order ??
      (OrderModule as any)?.default?.linkable?.order) as any,
    isList: true,
  },
  {
    linkable: PrescriptionModule.linkable.prescription,
    isList: true,
  }
)
