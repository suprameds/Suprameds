import { DeliveryEstimate } from "@/components/delivery-estimate"
import ProductActions from "@/components/product-actions"
import { ProductSubstitutes } from "@/components/product-substitutes"
import { ImageGallery } from "@/components/ui/image-gallery"
import { calcDiscountFromMRP } from "@/lib/hooks/use-pharma"
import { useLoaderData } from "@tanstack/react-router"

type DrugProduct = {
  schedule?: "OTC" | "H" | "H1" | "X"
  generic_name?: string | null
  composition?: string | null
  dosage_form?: string | null
  strength?: string | null
  gst_rate?: number | null
  mrp_paise?: number | null
  pack_size?: string | null
}

function scheduleCopy(schedule: DrugProduct["schedule"]) {
  if (schedule === "H" || schedule === "H1") return { label: "Prescription required", tone: "rx" as const }
  if (schedule === "X") return { label: "Not for online sale", tone: "blocked" as const }
  return { label: "OTC — No prescription needed", tone: "otc" as const }
}

const ProductDetails = () => {
  const { product, region } = useLoaderData({
    from: "/$countryCode/products/$handle",
  })

  const drug = (product as any)?.drug_product as DrugProduct | undefined
  const sched = scheduleCopy(drug?.schedule)

  const currentPrice =
    product.variants?.[0]?.calculated_price?.calculated_amount ?? 0
  const mrpRupees = drug?.mrp_paise ? drug.mrp_paise / 100 : null
  const discount = calcDiscountFromMRP(drug?.mrp_paise, currentPrice)

  return (
    <div style={{ background: "#FAFAF8" }}>
      <div className="content-container py-8 lg:py-12">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 lg:gap-12">
          {/* Left: Image gallery */}
          <div>
            <ImageGallery images={product.images || []} />
          </div>

          {/* Right: Product info */}
          <div className="flex flex-col gap-4">
            <div>
              <h1
                className="text-2xl lg:text-3xl font-semibold mb-2"
                style={{ color: "#0D1B2A", fontFamily: "Fraunces, Georgia, serif" }}
              >
                {product.title}
              </h1>

              {/* Badges row: schedule + discount */}
              <div className="flex flex-wrap items-center gap-2 mb-3">
                {drug?.schedule && (
                  <span
                    className="inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold border"
                    style={{
                      borderColor: sched.tone === "rx" ? "#F39C12" : sched.tone === "blocked" ? "#EF4444" : "#27AE60",
                      background: sched.tone === "rx" ? "rgba(243,156,18,0.10)" : sched.tone === "blocked" ? "rgba(239,68,68,0.10)" : "rgba(39,174,96,0.08)",
                      color: sched.tone === "rx" ? "#A16207" : sched.tone === "blocked" ? "#B91C1C" : "#1A7A4A",
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
                        : "#27AE60",
                      color: "#fff",
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
                  <span className="text-2xl font-bold" style={{ color: "#0D1B2A" }}>
                    ₹{currentPrice.toLocaleString("en-IN")}
                  </span>
                  {mrpRupees && mrpRupees > currentPrice && (
                    <span className="text-sm line-through" style={{ color: "#9CA3AF" }}>
                      MRP ₹{mrpRupees.toLocaleString("en-IN")}
                    </span>
                  )}
                  {discount && discount > 0 && (
                    <span className="text-sm font-semibold" style={{ color: "#16A34A" }}>
                      You save ₹{((mrpRupees ?? 0) - currentPrice).toLocaleString("en-IN")}
                    </span>
                  )}
                </div>
              )}

              {product.description && (
                <p className="text-sm leading-relaxed mb-4" style={{ color: "#2C3E50" }}>
                  {product.description}
                </p>
              )}
            </div>

            <ProductActions product={product} region={region} />

            {/* Delivery info box */}
            <div
              className="rounded-lg p-4 flex flex-col gap-2.5 mt-2"
              style={{ background: "#fff", border: "1px solid #EDE9E1" }}
            >
              <DeliveryEstimate />
              <div className="flex items-center gap-2.5 text-xs" style={{ color: "#2C3E50" }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#0E7C86" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
                </svg>
                <span>Genuine medicines · Pharmacist verified</span>
              </div>
            </div>

            {/* Medicine details card */}
            {drug && (
              <div
                className="rounded-lg overflow-hidden mt-2"
                style={{ border: "1px solid #EDE9E1" }}
              >
                <div className="px-4 py-3" style={{ background: "#F8F6F2", borderBottom: "1px solid #EDE9E1" }}>
                  <h2
                    className="text-sm font-semibold"
                    style={{ color: "#0D1B2A", fontFamily: "Fraunces, Georgia, serif" }}
                  >
                    Medicine Details
                  </h2>
                </div>
                <div className="px-4 py-4" style={{ background: "#fff" }}>
                  <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3 text-sm">
                    {drug.generic_name && (
                      <>
                        <dt style={{ color: "#666" }}>Generic name</dt>
                        <dd className="font-medium" style={{ color: "#0D1B2A" }}>{drug.generic_name}</dd>
                      </>
                    )}
                    {drug.dosage_form && (
                      <>
                        <dt style={{ color: "#666" }}>Dosage form</dt>
                        <dd className="font-medium" style={{ color: "#0D1B2A" }}>{drug.dosage_form}</dd>
                      </>
                    )}
                    {drug.strength && (
                      <>
                        <dt style={{ color: "#666" }}>Strength</dt>
                        <dd className="font-medium" style={{ color: "#0D1B2A" }}>{drug.strength}</dd>
                      </>
                    )}
                    {typeof drug.gst_rate === "number" && (
                      <>
                        <dt style={{ color: "#666" }}>GST</dt>
                        <dd className="font-medium" style={{ color: "#0D1B2A" }}>{drug.gst_rate}%</dd>
                      </>
                    )}
                  </dl>

                  {drug.composition && (
                    <div className="mt-4 pt-3" style={{ borderTop: "1px solid #EDE9E1" }}>
                      <div className="text-sm mb-1" style={{ color: "#666" }}>Composition</div>
                      <div className="text-sm font-medium" style={{ color: "#0D1B2A" }}>{drug.composition}</div>
                    </div>
                  )}
                </div>

                {(drug.schedule === "H" || drug.schedule === "H1") && (
                  <div
                    className="px-4 py-3 text-sm flex items-center gap-2"
                    style={{ background: "rgba(243,156,18,0.06)", borderTop: "1px solid rgba(243,156,18,0.2)", color: "#0D1B2A" }}
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#D68910" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/>
                    </svg>
                    This medicine requires a valid prescription. You can upload it during checkout.
                  </div>
                )}
              </div>
            )}

            {/* Therapeutic substitution suggestions */}
            <ProductSubstitutes productId={product.id} currentPrice={currentPrice} />
          </div>
        </div>
      </div>
    </div>
  )
}

export default ProductDetails
