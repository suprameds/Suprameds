import { defineLink } from "@medusajs/framework/utils"
import ProductModule from "@medusajs/medusa/product"
import PharmaModule from "../modules/pharma"

/**
 * Read-only link: DrugProduct.product_id → Product.id
 *
 * Uses readOnly: true because DrugProduct already stores product_id as a column.
 * No separate link table is created — the FK is on drug_product.product_id.
 *
 * Query usage:
 *   query.graph({ entity: "product", fields: ["id", "title", "drug_product.*"] })
 */
export default defineLink(
  {
    linkable: PharmaModule.linkable.drugProduct,
    field: "product_id",
  },
  ((ProductModule as any)?.linkable?.product ??
    (ProductModule as any)?.default?.linkable?.product) as any,
  { readOnly: true }
)
