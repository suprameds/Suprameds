import { DeliveryEstimate } from "@/components/delivery-estimate"
import ProductActions from "@/components/product-actions"
import { ImageGallery } from "@/components/ui/image-gallery"
import TabSections from "@/components/pdp/tab-sections"
import { calcDiscountFromMRP } from "@/lib/hooks/use-pharma"
import { trackViewItem } from "@/lib/utils/analytics"
import { addRecentlyViewed } from "@/lib/utils/recently-viewed"
import { useLoaderData } from "@tanstack/react-router"
import { useEffect } from "react"

type DrugProduct = {
  schedule?: "OTC" | "H" | "H1" | "X"
  generic_name?: string | null
  composition?: string | null
  dosage_form?: string | null
  strength?: string | null
  gst_rate?: number | null
  mrp_paise?: number | null
  pack_size?: string | null
  indications?: string | null
  contraindications?: string | null
  side_effects?: string | null
  drug_interactions?: string | null
  dosage_instructions?: string | null
  storage_instructions?: string | null
  habit_forming?: boolean
  is_chronic?: boolean
  therapeutic_class?: string | null
  metadata?: {
    manufacturer?: string
    chemical_class?: string
    action_class?: string
    safety_advice?: Record<string, { rating: string; note: string }>
    quick_tips?: string[]
    faqs?: { q: string; a: string }[]
    references?: string[]
  } | null
}

function scheduleCopy(schedule: DrugProduct["schedule"]) {
  if (schedule === "H" || schedule === "H1") return { label: "Prescription required", tone: "rx" as const }
  if (schedule === "X") return { label: "Not for online sale", tone: "blocked" as const }
  return { label: "OTC — No prescription needed", tone: "otc" as const }
}

const ProductDetails = () => {
  const { product, region } = useLoaderData({
    from: "/products/$handle",
  })

  const drug = (product as any)?.drug_product as DrugProduct | undefined
  const sched = scheduleCopy(drug?.schedule)
  const meta = drug?.metadata

  useEffect(() => {
    trackViewItem(product, region?.currency_code?.toUpperCase() || "INR")
    addRecentlyViewed({
      id: product.id,
      title: product.title || "",
      handle: product.handle || "",
      thumbnail: product.thumbnail || null,
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [product.id])

  const currentPrice =
    product.variants?.[0]?.calculated_price?.calculated_amount ?? 0
  const mrpRupees = drug?.mrp_paise ? drug.mrp_paise / 100 : null
  const discount = calcDiscountFromMRP(drug?.mrp_paise, currentPrice)

  return (
    <div style={{ background: "var(--bg-primary)" }}>
      <div className="content-container py-8 lg:py-12">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 lg:gap-12">
          {/* Left: Image gallery — fall back to thumbnail if no images uploaded */}
          <div>
            <ImageGallery
              images={
                product.images && product.images.length > 0
                  ? product.images
                  : product.thumbnail
                    ? [{ id: "thumb", url: product.thumbnail, rank: 0 } as any]
                    : []
              }
            />
          </div>

          {/* Right: Product info */}
          <div className="flex flex-col gap-4">
            <div>
              {/* Manufacturer */}
              {meta?.manufacturer && (
                <p className="text-xs font-semibold uppercase tracking-wider mb-1" style={{ color: "var(--brand-teal)" }}>
                  {meta.manufacturer}
                </p>
              )}

              <h1
                className="text-2xl lg:text-3xl font-semibold mb-2"
                style={{ color: "var(--text-primary)", fontFamily: "Fraunces, Georgia, serif" }}
              >
                {product.title}
              </h1>

              {/* Composition subtitle */}
              {drug?.composition && (
                <p className="text-sm mb-3" style={{ color: "var(--text-secondary)" }}>
                  {drug.composition}
                </p>
              )}

              {/* Badges row: schedule + discount */}
              <div className="flex flex-wrap items-center gap-2 mb-3">
                {drug?.schedule && (
                  <span
                    className="inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold border"
                    style={{
                      borderColor: sched.tone === "rx" ? "var(--brand-amber)" : sched.tone === "blocked" ? "var(--brand-red)" : "var(--brand-green)",
                      background: sched.tone === "rx" ? "rgba(243,156,18,0.10)" : sched.tone === "blocked" ? "rgba(239,68,68,0.10)" : "rgba(39,174,96,0.08)",
                      color: sched.tone === "rx" ? "var(--brand-amber-dark)" : sched.tone === "blocked" ? "var(--brand-red-dark)" : "var(--price-color)",
                    }}
                  >
                    {sched.label}
                  </span>
                )}
                {discount && discount > 0 && (
                  <span
                    className="inline-flex items-center rounded-full px-3 py-1 text-xs font-bold"
                    style={{
                      background: discount >= 40
                        ? "linear-gradient(135deg, #16A34A, #22C55E)"
                        : "var(--brand-green)",
                      color: "var(--text-inverse)",
                    }}
                  >
                    {discount}% OFF
                  </span>
                )}
              </div>

              {/* Price block with MRP */}
              {currentPrice > 0 && (
                <div
                  className="flex items-baseline gap-3 mb-4 px-4 py-3 rounded-lg"
                  style={{ background: "#F0FDF4", border: "1px solid #BBF7D0" }}
                >
                  <span className="text-2xl font-bold" style={{ color: "var(--price-color)" }}>
                    ₹{currentPrice.toLocaleString("en-IN")}
                  </span>
                  {mrpRupees && mrpRupees > currentPrice && (
                    <span className="text-sm line-through" style={{ color: "var(--text-secondary)" }}>
                      MRP ₹{mrpRupees.toLocaleString("en-IN")}
                    </span>
                  )}
                  {discount && discount > 0 && (
                    <span className="text-sm font-semibold" style={{ color: "var(--price-color)" }}>
                      You save ₹{((mrpRupees ?? 0) - currentPrice).toLocaleString("en-IN")}
                    </span>
                  )}
                </div>
              )}

              {product.description && (
                <p className="text-sm leading-relaxed mb-4" style={{ color: "var(--text-primary)" }}>
                  {product.description}
                </p>
              )}
            </div>

            <ProductActions product={product} region={region} />

            {/* Delivery info box */}
            <div
              className="rounded-lg p-4 flex flex-col gap-2.5 mt-2"
              style={{ background: "var(--bg-secondary)", border: "1px solid var(--border-primary)" }}
            >
              <DeliveryEstimate showLocationButton />
              <div className="flex items-center gap-2.5 text-xs" style={{ color: "var(--text-primary)" }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--brand-teal)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
                </svg>
                <span>Genuine medicines · Pharmacist verified</span>
              </div>
            </div>
          </div>
          {/* ── End right column ── */}
        </div>
        {/* ── End 2-column hero grid ── */}

        {/* Tabbed sections (Details, Safety, Clinical, Tips & FAQ, Alternatives) */}
        <div className="max-w-3xl">
          <TabSections
            drug={drug}
            meta={meta}
            productId={product.id}
            currentPrice={currentPrice}
          />
        </div>
      </div>
    </div>
  )
}

export default ProductDetails
