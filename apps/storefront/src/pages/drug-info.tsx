import ExpandableSection from "@/components/pdp/expandable-section"
import FactBox from "@/components/pdp/fact-box"
import FAQAccordion from "@/components/pdp/faq-accordion"
import QuickTips from "@/components/pdp/quick-tips"
import SafetyAdvice from "@/components/pdp/safety-advice"
import { calcDiscountFromMRP } from "@/lib/hooks/use-pharma"
import { Link, useLoaderData } from "@tanstack/react-router"

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
  pharmacist_reviewed?: boolean
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

type Substitute = {
  id: string
  title: string
  handle: string
  thumbnail?: string | null
  selling_price?: number | null
  mrp_paise?: number | null
  generic_name?: string | null
  manufacturer?: string | null
}

function scheduleBadge(schedule: DrugProduct["schedule"]) {
  if (schedule === "H" || schedule === "H1") {
    return {
      label: `Schedule ${schedule} — Prescription Required`,
      bg: "rgba(243,156,18,0.12)",
      border: "var(--brand-amber)",
      color: "var(--brand-amber-dark, #B7791F)",
    }
  }
  if (schedule === "X") {
    return {
      label: "Schedule X — Not for Sale",
      bg: "rgba(239,68,68,0.10)",
      border: "var(--brand-red)",
      color: "var(--brand-red-dark, #991B1B)",
    }
  }
  return {
    label: "OTC — No Prescription Needed",
    bg: "rgba(39,174,96,0.08)",
    border: "var(--brand-green)",
    color: "var(--price-color)",
  }
}

/* ───────────────────────── Breadcrumbs ───────────────────────── */
function Breadcrumbs({
  countryCode,
  drugName,
}: {
  countryCode: string
  drugName: string
}) {
  return (
    <nav
      aria-label="Breadcrumb"
      className="flex items-center gap-1.5 text-xs mb-6"
      style={{ color: "var(--text-tertiary)" }}
    >
      <Link
        to="/$countryCode"
        params={{ countryCode }}
        className="hover:underline"
        style={{ color: "var(--text-tertiary)" }}
      >
        Home
      </Link>
      <span aria-hidden>/</span>
      <Link
        to="/$countryCode/store"
        params={{ countryCode }}
        className="hover:underline"
        style={{ color: "var(--text-tertiary)" }}
      >
        Medicines
      </Link>
      <span aria-hidden>/</span>
      <span style={{ color: "var(--text-primary)" }}>{drugName}</span>
    </nav>
  )
}

/* ───────────────────────── Section Heading ───────────────────── */
function SectionHeading({
  children,
  icon,
}: {
  children: React.ReactNode
  icon?: React.ReactNode
}) {
  return (
    <div className="flex items-center gap-2 mb-3">
      {icon && (
        <span style={{ color: "var(--brand-teal)" }}>{icon}</span>
      )}
      <h2
        className="text-lg font-semibold"
        style={{
          color: "var(--text-primary)",
          fontFamily: "Fraunces, Georgia, serif",
        }}
      >
        {children}
      </h2>
    </div>
  )
}

/* ───────────────────────── Quick Facts Card ──────────────────── */
function QuickFactsCard({
  drug,
  currentPrice,
  productTitle,
}: {
  drug: DrugProduct
  currentPrice: number
  productTitle: string
}) {
  const meta = drug.metadata
  const mrpRupees = drug.mrp_paise ? drug.mrp_paise / 100 : null
  const discount = calcDiscountFromMRP(drug.mrp_paise, currentPrice)

  const facts = [
    { label: "Composition", value: drug.composition },
    { label: "Strength", value: drug.strength },
    { label: "Dosage Form", value: drug.dosage_form },
    { label: "Pack Size", value: drug.pack_size },
    { label: "Manufacturer", value: meta?.manufacturer },
    { label: "Therapeutic Class", value: drug.therapeutic_class },
  ].filter((f) => f.value)

  return (
    <div
      className="rounded-lg overflow-hidden"
      style={{
        border: "1px solid var(--border-primary)",
        background: "var(--bg-secondary)",
      }}
    >
      <div
        className="px-5 py-3"
        style={{
          background: "var(--bg-tertiary)",
          borderBottom: "1px solid var(--border-primary)",
        }}
      >
        <h2
          className="text-sm font-semibold"
          style={{
            color: "var(--text-primary)",
            fontFamily: "Fraunces, Georgia, serif",
          }}
        >
          Quick Facts
        </h2>
      </div>

      {/* Price row */}
      {currentPrice > 0 && (
        <div
          className="px-5 py-3 flex items-baseline gap-3 flex-wrap"
          style={{ borderBottom: "1px solid var(--border-secondary)" }}
        >
          <span
            className="text-xl font-bold"
            style={{ color: "var(--price-color)" }}
          >
            ₹{currentPrice.toLocaleString("en-IN")}
          </span>
          {mrpRupees && mrpRupees > currentPrice && (
            <span
              className="text-sm line-through"
              style={{ color: "var(--text-tertiary)" }}
            >
              MRP ₹{mrpRupees.toLocaleString("en-IN")}
            </span>
          )}
          {discount && discount > 0 && (
            <span
              className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-bold"
              style={{ background: "var(--brand-green)", color: "#fff" }}
            >
              {discount}% OFF
            </span>
          )}
        </div>
      )}

      {/* Facts grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-0">
        {facts.map((fact, i) => (
          <div
            key={fact.label}
            className="px-5 py-3"
            style={{
              borderBottom:
                i < facts.length - (facts.length % 2 === 0 ? 2 : 1)
                  ? "1px solid var(--border-secondary)"
                  : undefined,
            }}
          >
            <div
              className="text-[11px] font-medium mb-0.5 uppercase tracking-wider"
              style={{ color: "var(--text-tertiary)" }}
            >
              {fact.label}
            </div>
            <div
              className="text-sm font-medium"
              style={{ color: "var(--text-primary)" }}
            >
              {fact.value}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

/* ───────────────────────── Text Block Section ────────────────── */
function TextBlockSection({
  title,
  content,
  icon,
}: {
  title: string
  content: string | null | undefined
  icon?: React.ReactNode
}) {
  if (!content) return null

  return (
    <div
      className="rounded-lg overflow-hidden"
      style={{
        border: "1px solid var(--border-primary)",
        background: "var(--bg-secondary)",
      }}
    >
      <div
        className="px-5 py-3"
        style={{
          background: "var(--bg-tertiary)",
          borderBottom: "1px solid var(--border-primary)",
        }}
      >
        <div className="flex items-center gap-2">
          {icon && (
            <span style={{ color: "var(--brand-teal)" }}>{icon}</span>
          )}
          <h2
            className="text-sm font-semibold"
            style={{
              color: "var(--text-primary)",
              fontFamily: "Fraunces, Georgia, serif",
            }}
          >
            {title}
          </h2>
        </div>
      </div>
      <div className="px-5 py-4">
        <p
          className="text-sm leading-relaxed whitespace-pre-line"
          style={{ color: "var(--text-primary)" }}
        >
          {content}
        </p>
      </div>
    </div>
  )
}

/* ─────────────────────── Substitutes Grid ────────────────────── */
function SubstitutesGrid({
  substitutes,
  countryCode,
  currentPrice,
}: {
  substitutes: Substitute[]
  countryCode: string
  currentPrice: number
}) {
  if (!substitutes || substitutes.length === 0) return null

  return (
    <div>
      <SectionHeading
        icon={
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <polyline points="17 1 21 5 17 9" />
            <path d="M3 11V9a4 4 0 0 1 4-4h14" />
            <polyline points="7 23 3 19 7 15" />
            <path d="M21 13v2a4 4 0 0 1-4 4H3" />
          </svg>
        }
      >
        Generic Substitutes
      </SectionHeading>
      <p
        className="text-sm mb-4"
        style={{ color: "var(--text-secondary)" }}
      >
        Cheaper alternatives with the same composition.
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {substitutes.map((sub) => {
          const subMrp = sub.mrp_paise ? sub.mrp_paise / 100 : null
          const subPrice = sub.selling_price ?? subMrp
          const savings =
            subPrice && currentPrice > 0
              ? Math.round(((currentPrice - subPrice) / currentPrice) * 100)
              : null

          return (
            <Link
              key={sub.id}
              to="/$countryCode/drugs/$handle"
              params={{ countryCode, handle: sub.handle }}
              className="block rounded-lg p-4 transition-all hover:shadow-md"
              style={{
                border: "1px solid var(--border-primary)",
                background: "var(--bg-secondary)",
              }}
            >
              <div className="flex items-start gap-3">
                {sub.thumbnail && (
                  <img
                    src={sub.thumbnail}
                    alt={sub.title}
                    className="w-12 h-12 rounded object-cover flex-shrink-0"
                    loading="lazy"
                  />
                )}
                <div className="flex-1 min-w-0">
                  <h3
                    className="text-sm font-semibold truncate"
                    style={{ color: "var(--text-primary)" }}
                  >
                    {sub.title}
                  </h3>
                  {sub.generic_name && (
                    <p
                      className="text-xs truncate"
                      style={{ color: "var(--text-tertiary)" }}
                    >
                      {sub.generic_name}
                    </p>
                  )}
                  {sub.manufacturer && (
                    <p
                      className="text-[11px] mt-0.5 truncate"
                      style={{ color: "var(--text-tertiary)" }}
                    >
                      {sub.manufacturer}
                    </p>
                  )}
                </div>
              </div>
              <div className="mt-3 flex items-center justify-between">
                <div className="flex items-baseline gap-2">
                  {subPrice && (
                    <span
                      className="text-sm font-bold"
                      style={{ color: "var(--price-color)" }}
                    >
                      ₹{subPrice.toLocaleString("en-IN")}
                    </span>
                  )}
                  {subMrp && subPrice && subMrp > subPrice && (
                    <span
                      className="text-xs line-through"
                      style={{ color: "var(--text-tertiary)" }}
                    >
                      ₹{subMrp.toLocaleString("en-IN")}
                    </span>
                  )}
                </div>
                {savings && savings > 0 && (
                  <span
                    className="text-[11px] font-bold px-2 py-0.5 rounded-full"
                    style={{
                      background: "rgba(39,174,96,0.1)",
                      color: "var(--price-color)",
                    }}
                  >
                    {savings}% cheaper
                  </span>
                )}
              </div>
            </Link>
          )
        })}
      </div>
    </div>
  )
}

/* ───────────────────────── Disclaimer ────────────────────────── */
function Disclaimer({ isRx }: { isRx: boolean }) {
  return (
    <div
      className="rounded-lg px-5 py-4 flex gap-3"
      style={{
        background: isRx ? "rgba(243,156,18,0.08)" : "var(--bg-tertiary)",
        border: `1px solid ${isRx ? "var(--brand-amber)" : "var(--border-primary)"}`,
      }}
    >
      <svg
        width="20"
        height="20"
        viewBox="0 0 24 24"
        fill="none"
        stroke={isRx ? "var(--brand-amber)" : "var(--text-tertiary)"}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="flex-shrink-0 mt-0.5"
      >
        <circle cx="12" cy="12" r="10" />
        <line x1="12" y1="8" x2="12" y2="12" />
        <line x1="12" y1="16" x2="12.01" y2="16" />
      </svg>
      <div>
        <p
          className="text-sm font-medium mb-1"
          style={{ color: "var(--text-primary)" }}
        >
          Medical Disclaimer
        </p>
        <p
          className="text-xs leading-relaxed"
          style={{ color: "var(--text-secondary)" }}
        >
          This information is for educational purposes only and is not a
          substitute for professional medical advice. Always consult your doctor
          or qualified healthcare provider before taking any medication. Do not
          self-medicate.
        </p>
      </div>
    </div>
  )
}

/* ─────────────── Pharmacist Review Pending Page ──────────────── */
function PendingReviewPage({
  drug,
  product,
  countryCode,
}: {
  drug: DrugProduct
  product: any
  countryCode: string
}) {
  return (
    <div style={{ background: "var(--bg-primary)" }}>
      <div className="content-container py-8 lg:py-12">
        <Breadcrumbs
          countryCode={countryCode}
          drugName={drug.generic_name || product.title}
        />

        <div className="max-w-2xl mx-auto text-center py-16">
          <div
            className="w-16 h-16 mx-auto mb-6 rounded-full flex items-center justify-center"
            style={{ background: "var(--bg-tertiary)" }}
          >
            <svg
              width="32"
              height="32"
              viewBox="0 0 24 24"
              fill="none"
              stroke="var(--text-tertiary)"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <circle cx="12" cy="12" r="10" />
              <polyline points="12 6 12 12 16 14" />
            </svg>
          </div>

          <h1
            className="text-2xl lg:text-3xl font-semibold mb-2"
            style={{
              color: "var(--text-primary)",
              fontFamily: "Fraunces, Georgia, serif",
            }}
          >
            {product.title}
          </h1>
          {drug.generic_name && (
            <p className="text-base mb-6" style={{ color: "var(--text-secondary)" }}>
              {drug.generic_name}
            </p>
          )}

          <p
            className="text-sm leading-relaxed mb-8"
            style={{ color: "var(--text-tertiary)" }}
          >
            Detailed clinical information is coming soon. Our pharmacist is
            currently reviewing this medicine to ensure accuracy of all medical
            details.
          </p>

          <Link
            to="/$countryCode/products/$handle"
            params={{ countryCode, handle: product.handle }}
            className="inline-flex items-center gap-2 px-6 py-3 rounded-lg text-sm font-semibold transition-colors"
            style={{
              background: "var(--brand-teal)",
              color: "var(--text-inverse)",
            }}
          >
            View Product Page
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <polyline points="9 18 15 12 9 6" />
            </svg>
          </Link>
        </div>
      </div>
    </div>
  )
}

/* ═══════════════════════ MAIN PAGE COMPONENT ═════════════════════ */
const DrugInfoPage = () => {
  const { product, countryCode, substitutes } = useLoaderData({
    from: "/$countryCode/drugs/$handle",
  })

  const drug = (product as any)?.drug_product as DrugProduct | undefined
  const meta = drug?.metadata

  // If no drug data at all, redirect-like experience
  if (!drug) {
    return (
      <div style={{ background: "var(--bg-primary)" }}>
        <div className="content-container py-8 lg:py-12">
          <div className="max-w-2xl mx-auto text-center py-16">
            <h1
              className="text-2xl font-semibold mb-4"
              style={{
                color: "var(--text-primary)",
                fontFamily: "Fraunces, Georgia, serif",
              }}
            >
              {product.title}
            </h1>
            <p className="text-sm mb-6" style={{ color: "var(--text-secondary)" }}>
              Drug information is not yet available for this product.
            </p>
            <Link
              to="/$countryCode/products/$handle"
              params={{ countryCode, handle: product.handle }}
              className="inline-flex items-center gap-2 px-6 py-3 rounded-lg text-sm font-semibold"
              style={{
                background: "var(--brand-teal)",
                color: "var(--text-inverse)",
              }}
            >
              View Product Page
            </Link>
          </div>
        </div>
      </div>
    )
  }

  // ── Compliance gate: pharmacist review ──
  if (drug.pharmacist_reviewed === false) {
    return (
      <PendingReviewPage
        drug={drug}
        product={product}
        countryCode={countryCode}
      />
    )
  }

  const isRx = drug.schedule === "H" || drug.schedule === "H1"
  const badge = scheduleBadge(drug.schedule)
  const currentPrice =
    product.variants?.[0]?.calculated_price?.calculated_amount ?? 0

  return (
    <div style={{ background: "var(--bg-primary)" }}>
      <div className="content-container py-8 lg:py-12">
        <Breadcrumbs
          countryCode={countryCode}
          drugName={drug.generic_name || product.title}
        />

        {/* ── Header ── */}
        <div className="mb-8">
          <div className="flex flex-wrap items-center gap-3 mb-2">
            <span
              className="inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold border"
              style={{
                borderColor: badge.border,
                background: badge.bg,
                color: badge.color,
              }}
            >
              {badge.label}
            </span>
            {drug.dosage_form && (
              <span
                className="inline-flex items-center rounded-full px-3 py-1 text-xs font-medium"
                style={{
                  background: "var(--bg-tertiary)",
                  color: "var(--text-secondary)",
                  border: "1px solid var(--border-secondary)",
                }}
              >
                {drug.dosage_form}
              </span>
            )}
          </div>

          <h1
            className="text-2xl lg:text-4xl font-semibold mb-1"
            style={{
              color: "var(--text-primary)",
              fontFamily: "Fraunces, Georgia, serif",
            }}
          >
            {drug.generic_name || product.title}
          </h1>

          {drug.generic_name && drug.generic_name !== product.title && (
            <p
              className="text-base lg:text-lg"
              style={{ color: "var(--text-secondary)" }}
            >
              {product.title}
            </p>
          )}

          {meta?.manufacturer && (
            <p
              className="text-xs font-semibold uppercase tracking-wider mt-2"
              style={{ color: "var(--brand-teal)" }}
            >
              {meta.manufacturer}
            </p>
          )}
        </div>

        {/* ── Two-column layout ── */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main content (left 2/3) */}
          <div className="lg:col-span-2 flex flex-col gap-6">
            {/* Uses / Indications */}
            <TextBlockSection
              title="Uses & Indications"
              content={drug.indications}
              icon={
                <svg
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
                </svg>
              }
            />

            {/* Side Effects — collapsed by default */}
            {drug.side_effects && (
              <div
                className="rounded-lg overflow-hidden"
                style={{
                  border: "1px solid var(--border-primary)",
                  background: "var(--bg-secondary)",
                }}
              >
                <ExpandableSection
                  title="Side Effects"
                  content={drug.side_effects}
                  defaultOpen={false}
                />
              </div>
            )}

            {/* Drug Interactions */}
            <TextBlockSection
              title="Drug Interactions"
              content={drug.drug_interactions}
              icon={
                <svg
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                  <line x1="12" y1="9" x2="12" y2="13" />
                  <line x1="12" y1="17" x2="12.01" y2="17" />
                </svg>
              }
            />

            {/* Contraindications */}
            <TextBlockSection
              title="Contraindications"
              content={drug.contraindications}
              icon={
                <svg
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <circle cx="12" cy="12" r="10" />
                  <line x1="4.93" y1="4.93" x2="19.07" y2="19.07" />
                </svg>
              }
            />

            {/* Dosage & Administration */}
            <TextBlockSection
              title="Dosage & Administration"
              content={drug.dosage_instructions}
              icon={
                <svg
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M18 20V10" />
                  <path d="M12 20V4" />
                  <path d="M6 20v-6" />
                </svg>
              }
            />

            {/* Storage Instructions */}
            <TextBlockSection
              title="Storage Instructions"
              content={drug.storage_instructions}
              icon={
                <svg
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <rect x="4" y="2" width="16" height="20" rx="2" ry="2" />
                  <path d="M12 6v6" />
                  <line x1="8" y1="18" x2="16" y2="18" />
                </svg>
              }
            />

            {/* Safety Advice */}
            <SafetyAdvice safetyAdvice={meta?.safety_advice} />

            {/* Quick Tips */}
            <QuickTips tips={meta?.quick_tips} />

            {/* FAQs */}
            <FAQAccordion faqs={meta?.faqs} />

            {/* Substitutes */}
            <SubstitutesGrid
              substitutes={substitutes as Substitute[]}
              countryCode={countryCode}
              currentPrice={currentPrice}
            />

            {/* Disclaimer */}
            <Disclaimer isRx={isRx} />
          </div>

          {/* Sidebar (right 1/3) */}
          <div className="flex flex-col gap-6">
            {/* Quick Facts */}
            <QuickFactsCard
              drug={drug}
              currentPrice={currentPrice}
              productTitle={product.title}
            />

            {/* Fact Box (chemical/therapeutic/action class) */}
            <FactBox
              chemicalClass={meta?.chemical_class}
              therapeuticClass={drug.therapeutic_class}
              actionClass={meta?.action_class}
              habitForming={drug.habit_forming}
            />

            {/* CTA Banner */}
            <div
              className="rounded-lg p-5 text-center"
              style={{
                background: "var(--brand-teal)",
                color: "var(--text-inverse)",
              }}
            >
              <div className="mb-3">
                <svg
                  width="28"
                  height="28"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="mx-auto"
                >
                  <circle cx="9" cy="21" r="1" />
                  <circle cx="20" cy="21" r="1" />
                  <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6" />
                </svg>
              </div>
              <p className="text-sm font-semibold mb-1">
                {isRx
                  ? "Buy with Prescription"
                  : "Buy this Medicine"}
              </p>
              <p className="text-xs opacity-80 mb-4">
                {isRx
                  ? "Upload your prescription to order"
                  : "Genuine medicines at best prices"}
              </p>
              <Link
                to="/$countryCode/products/$handle"
                params={{ countryCode, handle: product.handle }}
                className="inline-block w-full py-2.5 rounded-lg text-sm font-semibold transition-colors"
                style={{
                  background: "var(--text-inverse)",
                  color: "var(--brand-teal)",
                }}
              >
                Go to Product Page
              </Link>
            </div>

            {/* Sticky disclaimer on desktop */}
            <div
              className="hidden lg:block rounded-lg px-4 py-3"
              style={{
                background: "var(--bg-tertiary)",
                border: "1px solid var(--border-secondary)",
                position: "sticky",
                top: "5rem",
              }}
            >
              <p
                className="text-[11px] leading-relaxed"
                style={{ color: "var(--text-tertiary)" }}
              >
                Consult your doctor before taking any medication. The
                information on this page is intended for educational purposes
                and should not be used for self-diagnosis or treatment.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default DrugInfoPage
