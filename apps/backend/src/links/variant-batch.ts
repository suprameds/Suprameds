import { defineLink } from "@medusajs/framework/utils"
import ProductModule from "@medusajs/medusa/product"
import InventoryBatchModule from "../modules/inventoryBatch"

/**
 * Read-only link: Batch.product_variant_id → ProductVariant.id
 *
 * Enables query.graph traversal:
 *   query.graph({ entity: "product_variant", fields: ["batch.*"] })
 *   query.graph({ entity: "batch", fields: ["product_variant.*"] })
 *
 * readOnly because Batch already stores product_variant_id as a column.
 */
export default defineLink(
  {
    linkable: InventoryBatchModule.linkable.batch,
    field: "product_variant_id",
  },
  ((ProductModule as any)?.linkable?.productVariant ??
    (ProductModule as any)?.default?.linkable?.productVariant) as any,
  { readOnly: true }
)
