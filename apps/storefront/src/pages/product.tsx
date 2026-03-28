import { DeliveryEstimate } from "@/components/delivery-estimate"
import ProductActions from "@/components/product-actions"
import { ProductSubstitutes } from "@/components/product-substitutes"
import { ImageGallery } from "@/components/ui/image-gallery"
import { calcDiscountFromMRP } from "@/lib/hooks/use-pharma"
import { trackViewItem } from "@/lib/utils/analytics"
import { useLoaderData } from "@tanstack/react-router"
import { useEffect } from "react"

// PDP components (Tata 1mg inspired)
import FactBox from "@/components/pdp/fact-box"
import SafetyAdvice from "@/components/pdp/safety-advice"
import ExpandableSection from "@/components/pdp/expandable-section"
import QuickTips from "@/components/pdp/quick-tips"
import FAQAccordion from "@/components/pdp/faq-accordion"

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
    from: "/$countryCode/products/$handle",
  })

  const drug = (product as any)?.drug_product as DrugProduct | undefined
  const sched = scheduleCopy(drug?.schedule)
  const meta = drug?.metadata

  useEffect(() => {
    trackViewItem(product, region?.currency_code?.toUpperCase() || "INR")
  }, [product.id])

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
              {/* Manufacturer */}
              {meta?.manufacturer && (
                <p className="text-xs font-semibold uppercase tracking-wider mb-1" style={{ color: "#0E7C86" }}>
                  {meta.manufacturer}
                </p>
              )}

              <h1
                className="text-2xl lg:text-3xl font-semibold mb-2"
                style={{ color: "#0D1B2A", fontFamily: "Fraunces, Georgia, serif" }}
              >
                {product.title}
              </h1>

              {/* Composition subtitle */}
              {drug?.composition && (
                <p className="text-sm mb-3" style={{ color: "#6B7280" }}>
                  {drug.composition}
                </p>
              )}

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
                  <span className="text-2xl font-bold" style={{ color: "#16A34A" }}>
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
          </div>
          {/* ── End right column ── */}
        </div>
        {/* ── End 2-column hero grid ── */}

        {/* ══════════════════════════════════════════════════════
             FULL-WIDTH SECTIONS BELOW THE FOLD (Tata 1mg style)
             ══════════════════════════════════════════════════════ */}
        <div className="flex flex-col gap-4 mt-8 max-w-3xl">
          {/* Medicine details card */}
          {drug && (
            <div
              className="rounded-lg overflow-hidden"
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
                      <dd className="font-medium capitalize" style={{ color: "#0D1B2A" }}>{drug.dosage_form}</dd>
                    </>
                  )}
                  {drug.strength && (
                    <>
                      <dt style={{ color: "#666" }}>Strength</dt>
                      <dd className="font-medium" style={{ color: "#0D1B2A" }}>{drug.strength}</dd>
                    </>
                  )}
                  {drug.pack_size && (
                    <>
                      <dt style={{ color: "#666" }}>Pack size</dt>
                      <dd className="font-medium capitalize" style={{ color: "#0D1B2A" }}>{drug.pack_size}</dd>
                    </>
                  )}
                  {typeof drug.gst_rate === "number" && (
                    <>
                      <dt style={{ color: "#666" }}>GST</dt>
                      <dd className="font-medium" style={{ color: "#0D1B2A" }}>{drug.gst_rate}%</dd>
                    </>
                  )}
                  {drug.storage_instructions && (
                    <>
                      <dt style={{ color: "#666" }}>Storage</dt>
                      <dd className="font-medium" style={{ color: "#0D1B2A" }}>{drug.storage_instructions}</dd>
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

          {/* Fact Box */}
          <FactBox
            chemicalClass={meta?.chemical_class}
            therapeuticClass={drug?.therapeutic_class}
            actionClass={meta?.action_class}
            habitForming={drug?.habit_forming}
          />

          {/* Safety Advice */}
          <SafetyAdvice safetyAdvice={meta?.safety_advice} />

          {/* Expandable clinical sections */}
          {(drug?.indications || drug?.side_effects || drug?.dosage_instructions || drug?.drug_interactions || drug?.contraindications) && (
            <div className="rounded-lg overflow-hidden" style={{ border: "1px solid #EDE9E1", background: "#fff" }}>
              <ExpandableSection title="Uses & Indications" content={drug?.indications} defaultOpen />
              <ExpandableSection title="Side Effects" content={drug?.side_effects} />
              <ExpandableSection title="How to Use" content={drug?.dosage_instructions} />
              <ExpandableSection title="Drug Interactions" content={drug?.drug_interactions} />
              <ExpandableSection title="Contraindications" content={drug?.contraindications} />
            </div>
          )}

          {/* Quick Tips */}
          <QuickTips tips={meta?.quick_tips} />

          {/* FAQs */}
          <FAQAccordion faqs={meta?.faqs} />

          {/* Therapeutic substitution suggestions */}
          <ProductSubstitutes productId={product.id} currentPrice={currentPrice} />

          {/* References */}
          {meta?.references && meta.references.length > 0 && (
            <div className="mt-2">
              <h3 className="text-xs font-semibold mb-2" style={{ color: "#9CA3AF", fontFamily: "Fraunces, Georgia, serif" }}>
                References
              </h3>
              <ul className="flex flex-wrap gap-1.5">
                {meta.references.map((ref, i) => (
                  <li
                    key={i}
                    className="text-[10px] px-2 py-1 rounded-full"
                    style={{ background: "#F3F0EB", color: "#6B7280" }}
                  >
                    {ref}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default ProductDetails
