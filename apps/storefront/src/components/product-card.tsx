import ProductPrice from "@/components/product-price"
import { Thumbnail } from "@/components/ui/thumbnail"
import { getCountryCodeFromPath } from "@/lib/utils/region"
import { HttpTypes } from "@medusajs/types"
import { Link, useLocation } from "@tanstack/react-router"

interface ProductCardProps {
  product: HttpTypes.StoreProduct;
}

type DrugProduct = {
  schedule?: "OTC" | "H" | "H1" | "X"
  dosage_form?: string | null
  strength?: string | null
}

function scheduleLabel(schedule: DrugProduct["schedule"]) {
  if (schedule === "H" || schedule === "H1") return "Rx"
  if (schedule === "X") return "Blocked"
  return "OTC"
}

const ProductCard = ({ product }: ProductCardProps) => {
  const location = useLocation()
  const countryCode = getCountryCodeFromPath(location.pathname) || "us"
  const drug = (product as any)?.drug_product as DrugProduct | undefined
  const sched = drug?.schedule
  const strength = drug?.strength ?? null
  const form = drug?.dosage_form ?? null

  return (
    <Link
      to="/$countryCode/products/$handle"
      params={{ countryCode, handle: product.handle }}
      className="group flex flex-col w-full"
    >
      <div className="aspect-[29/34] w-full overflow-hidden bg-zinc-50 relative">
        <Thumbnail
          thumbnail={product.thumbnail}
          alt={product.title}
          className="absolute inset-0 object-cover object-center w-full h-full"
        />
      </div>

      <div className="flex text-base font-medium mt-4 justify-between">
        <span className="text-zinc-900">{product.title}</span>
        <ProductPrice
          product={product}
          variant={product.variants?.[0]}
          className="text-zinc-600"
        />
      </div>

      {(sched || strength || form) && (
        <div className="mt-1.5 flex items-center gap-2 text-xs text-zinc-600">
          {sched && (
            <span
              className="inline-flex items-center rounded-full px-2 py-0.5 border"
              style={{
                borderColor: sched === "H" || sched === "H1" ? "#F39C12" : "#E5E7EB",
                color: sched === "H" || sched === "H1" ? "#A16207" : "#52525B",
                background: sched === "H" || sched === "H1" ? "rgba(243,156,18,0.10)" : "#fff",
              }}
            >
              {scheduleLabel(sched)}
            </span>
          )}
          <span className="truncate">
            {[form, strength].filter(Boolean).join(" • ")}
          </span>
        </div>
      )}
    </Link>
  )
}

export default ProductCard
