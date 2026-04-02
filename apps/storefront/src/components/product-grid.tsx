import { HttpTypes } from "@medusajs/types"
import { useMemo } from "react"
import { useBulkPharma, type DrugProductMeta } from "@/lib/hooks/use-pharma"
import ProductCard from "@/components/product-card"

interface ProductGridProps {
  products: HttpTypes.StoreProduct[]
  className?: string
}

/**
 * A product grid that automatically fetches pharma metadata (MRP, schedule, etc.)
 * for all visible products in a single bulk API call, then augments each product
 * with `drug_product` before passing to ProductCard.
 *
 * This ensures discount %, Rx badges, generic names, etc. display on listing pages.
 */
export default function ProductGrid({ products, className }: ProductGridProps) {
  const productIds = useMemo(
    () => products.map((p) => p.id).filter(Boolean),
    [products]
  )

  const { data: pharmaMap } = useBulkPharma(productIds)

  const enrichedProducts = useMemo(() => {
    if (!pharmaMap) return products
    return products.map((p) => {
      const dp = pharmaMap[p.id]
      if (!dp) return p
      return { ...p, drug_product: dp } as HttpTypes.StoreProduct & { drug_product: DrugProductMeta }
    })
  }, [products, pharmaMap])

  return (
    <div className={className || "grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4"}>
      {enrichedProducts.map((product) => (
        <ProductCard key={product.id} product={product} />
      ))}
    </div>
  )
}
