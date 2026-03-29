import { defineLink } from "@medusajs/framework/utils"
import OrderModule from "@medusajs/medusa/order"
import ShipmentModule from "../modules/shipment"

/**
 * Read-only link: Shipment.order_id → Order.id
 *
 * Enables query.graph traversal for order→shipment traceability:
 *   query.graph({ entity: "order", fields: ["shipment.*"] })
 */
export default defineLink(
  {
    linkable: ShipmentModule.linkable.shipment,
    field: "order_id",
  },
  ((OrderModule as any)?.linkable?.order ??
    (OrderModule as any)?.default?.linkable?.order) as any,
  { readOnly: true }
)
