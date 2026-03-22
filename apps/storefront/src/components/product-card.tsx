import { getProductPrice } from "@/lib/utils/price"
import { Thumbnail } from "@/components/ui/thumbnail"
import { getCountryCodeFromPath } from "@/lib/utils/region"
import { calcDiscountFromMRP } from "@/lib/hooks/use-pharma"
import { HttpTypes } from "@medusajs/types"
import { Link, useLocation } from "@tanstack/react-router"

interface ProductCardProps {
  product: HttpTypes.StoreProduct;
}

type DrugProduct = {
  schedule?: "OTC" | "H" | "H1" | "X"
  dosage_form?: string | null
  strength?: string | null
  generic_name?: string | null
  manufacturer?: string | null
  pack_size?: string | null
  mrp_paise?: number | null
}

/**
 * Calculates discount: prefers MRP-based (from drug_product.mrp_paise),
 * falls back to Medusa price list discount (original vs calculated).
 */
function getDiscountPercent(product: HttpTypes.StoreProduct, drug?: DrugProduct): number | null {
  const variant = product.variants?.[0]
  const calc = (variant as any)?.calculated_price
  const sellingPrice = calc?.calculated_amount

  // Method 1: MRP-based discount (primary for generic medicines)
  if (drug?.mrp_paise && sellingPrice) {
    const mrpDiscount = calcDiscountFromMRP(drug.mrp_paise, sellingPrice)
    if (mrpDiscount && mrpDiscount > 0) return mrpDiscount
  }

  // Method 2: Medusa price list discount (fallback)
  if (!calc) return null
  const original = calc.original_amount
  const current = calc.calculated_amount
  if (!original || !current || original <= current) return null
  return Math.round(((original - current) / original) * 100)
}

const ProductCard = ({ product }: ProductCardProps) => {
  const location = useLocation()
  const countryCode = getCountryCodeFromPath(location.pathname) || "in"
  const drug = (product as any)?.drug_product as DrugProduct | undefined
  const sched = drug?.schedule
  const strength = drug?.strength ?? null
  const form = drug?.dosage_form ?? null
  const genericName = drug?.generic_name ?? null
  const manufacturer = drug?.manufacturer ?? null
  const packSize = drug?.pack_size ?? null
  const discount = getDiscountPercent(product, drug)
  const isRx = sched === "H" || sched === "H1"
  const isBlocked = sched === "X"

  const { cheapestPrice } = getProductPrice({ product, variant_id: product.variants?.[0]?.id })

  // MRP from drug_product (in paise → rupees)
  const mrpRupees = drug?.mrp_paise ? drug.mrp_paise / 100 : null
  const sellingPrice = cheapestPrice?.calculated_price_number ?? null
  const hasMrpDiscount = mrpRupees !== null && sellingPrice !== null && mrpRupees > sellingPrice

  return (
    <Link
      to="/$countryCode/products/$handle"
      params={{ countryCode, handle: product.handle }}
      className="group relative flex flex-col w-full rounded-xl overflow-hidden transition-all duration-200 hover:shadow-lg"
      style={{ background: "#fff", border: "1px solid #E8E4DD" }}
    >
      {/* ── Badges overlay ── */}
      <div className="absolute top-0 left-0 right-0 z-10 flex items-start justify-between p-2.5 pointer-events-none">
        {/* Left: discount badge */}
        <div className="flex flex-col gap-1.5">
          {discount && discount > 0 && (
            <span
              className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold tracking-wide shadow-sm"
              style={{
                background: discount >= 40
                  ? "linear-gradient(135deg, #16A34A, #22C55E)"
                  : discount >= 20
                    ? "#27AE60"
                    : "#4ADE80",
                color: "#fff",
              }}
            >
              {discount}% OFF
            </span>
          )}
        </div>

        {/* Right: Rx / OTC badge */}
        <div className="flex flex-col items-end gap-1.5">
          {isRx && (
            <span
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold shadow-sm"
              style={{
                background: "rgba(255,255,255,0.92)",
                color: "#B45309",
                border: "1.5px solid #F59E0B",
                backdropFilter: "blur(4px)",
              }}
            >
              <svg width="10" height="10" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                <path d="M4 2v12M4 2h4.5a3.5 3.5 0 0 1 0 7H4m4 0 4 5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              Rx
            </span>
          )}
          {isBlocked && (
            <span
              className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold shadow-sm"
              style={{ background: "#FEE2E2", color: "#991B1B", border: "1.5px solid #FECACA" }}
            >
              Schedule X
            </span>
          )}
        </div>
      </div>

      {/* ── Thumbnail ── */}
      <div className="aspect-square w-full overflow-hidden relative" style={{ background: "#FAFAF8" }}>
        <Thumbnail
          thumbnail={product.thumbnail}
          alt={product.title}
          className="absolute inset-0 object-contain object-center w-full h-full p-3 transition-transform duration-500 group-hover:scale-105"
        />
      </div>

      {/* ── Card body ── */}
      <div className="p-3 flex flex-col gap-1 flex-1" style={{ borderTop: "1px solid #F3F0EB" }}>
        {/* Manufacturer */}
        {manufacturer && (
          <p className="text-[10px] font-semibold uppercase tracking-wider line-clamp-1" style={{ color: "#0E7C86" }}>
            {manufacturer}
          </p>
        )}

        {/* Product title */}
        <h3 className="text-[13px] font-semibold leading-snug line-clamp-2 min-h-[2.5em]" style={{ color: "#0D1B2A" }}>
          {product.title}
        </h3>

        {/* Form / strength / pack info */}
        {(form || strength || packSize) && (
          <p className="text-[11px] line-clamp-1" style={{ color: "#6B7280" }}>
            {[form, strength, packSize].filter(Boolean).join(" · ")}
          </p>
        )}

        {/* Generic name */}
        {genericName && (
          <p className="text-[10px] italic line-clamp-1" style={{ color: "#9CA3AF" }}>
            {genericName}
          </p>
        )}

        {/* ── Price section ── */}
        <div className="mt-auto pt-2 flex items-end justify-between gap-2">
          <div className="flex flex-col">
            {/* Current price */}
            <span className="text-base font-bold" style={{ color: "#0D1B2A" }}>
              {cheapestPrice?.calculated_price ?? "—"}
            </span>

            {/* MRP strikethrough — prefers pharma MRP, falls back to Medusa original price */}
            {hasMrpDiscount ? (
              <span className="text-[11px] line-through" style={{ color: "#9CA3AF" }}>
                MRP ₹{mrpRupees!.toLocaleString("en-IN")}
              </span>
            ) : (
              cheapestPrice && cheapestPrice.original_price_number > cheapestPrice.calculated_price_number && (
                <span className="text-[11px] line-through" style={{ color: "#9CA3AF" }}>
                  MRP {cheapestPrice.original_price}
                </span>
              )
            )}
          </div>

          {/* Schedule pill (bottom-right) */}
          {sched && !isBlocked && (
            <span
              className="text-[9px] font-semibold px-1.5 py-0.5 rounded-full whitespace-nowrap"
              style={{
                background: isRx ? "rgba(245,158,11,0.10)" : "rgba(14,124,134,0.08)",
                color: isRx ? "#A16207" : "#0E7C86",
              }}
            >
              {isRx ? "Rx Required" : "OTC"}
            </span>
          )}
        </div>
      </div>
    </Link>
  )
}

export default ProductCard
