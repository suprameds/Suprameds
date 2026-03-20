import { defineLink } from "@medusajs/framework/utils"
import CustomerModule from "@medusajs/medusa/customer"
import PrescriptionModule from "../modules/prescription"

/**
 * Read-only link: Prescription.customer_id → Customer.id
 *
 * Allows query.graph to resolve customer from a prescription without
 * creating a separate link table.
 *
 * Query usage:
 *   query.graph({ entity: "prescription", fields: ["id", "status", "customer.*"] })
 */
export default defineLink(
  {
    linkable: PrescriptionModule.linkable.prescription,
    field: "customer_id",
    isList: false,
  },
  ((CustomerModule as any)?.linkable?.customer ??
    (CustomerModule as any)?.default?.linkable?.customer) as any,
  { readOnly: true }
)
