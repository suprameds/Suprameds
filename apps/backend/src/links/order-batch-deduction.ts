import { defineLink } from "@medusajs/framework/utils"
import OrderModule from "@medusajs/medusa/order"
import InventoryBatchModule from "../modules/inventoryBatch"

/**
 * Read-only link: BatchDeduction.order_id → Order.id
 *
 * Enables query.graph traversal:
 *   query.graph({ entity: "order", fields: ["batch_deduction.*"] })
 *
 * readOnly because BatchDeduction already stores order_id as a column.
 */
export default defineLink(
  {
    linkable: InventoryBatchModule.linkable.batchDeduction,
    field: "order_id",
  },
  ((OrderModule as any)?.linkable?.order ??
    (OrderModule as any)?.default?.linkable?.order) as any,
  { readOnly: true }
)
