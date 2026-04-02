import { sdk } from "@/lib/utils/sdk"
import { getCountryCodeFromPath } from "@/lib/utils/region"
import { Link, useLocation } from "@tanstack/react-router"
import { useEffect, useState } from "react"

// ---------- Types ----------

type Substitute = {
  id: string
  title: string
  generic_name: string
  composition: string
  unit_price: number
  mrp: number
  savings_pct: number
  handle: string
}

type SubstitutesResponse = {
  substitutes: Substitute[]
}

// ---------- Colors ----------

const TEAL = "var(--brand-teal)"
const TEAL_LIGHT = "rgba(14,124,134,0.06)"
const NAVY = "var(--text-primary)"
const GREEN = "var(--price-color)"
const GREEN_BG = "rgba(26,122,74,0.08)"
const GREY_TEXT = "var(--text-secondary)"
const BORDER = "var(--border-primary)"

// ---------- Component ----------

export const ProductSubstitutes = ({
  productId,
  currentPrice,
}: {
  productId: string
  currentPrice: number
}) => {
  const [substitutes, setSubstitutes] = useState<Substitute[]>([])
  const [loading, setLoading] = useState(true)
  const location = useLocation()
  const countryCode = getCountryCodeFromPath(location.pathname) || "in"

  useEffect(() => {
    let cancelled = false

    async function fetchSubstitutes() {
      try {
        const data = await sdk.client.fetch<SubstitutesResponse>(
          `/store/products/substitutes?product_id=${encodeURIComponent(productId)}`,
          { method: "GET" }
        )
        if (!cancelled) {
          setSubstitutes((data.substitutes ?? []).slice(0, 5))
        }
      } catch {
        // Silently fail — substitutes are supplementary
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    fetchSubstitutes()
    return () => { cancelled = true }
  }, [productId])

  if (loading || substitutes.length === 0) return null

  return (
    <div className="mt-6">
      <div
        className="rounded-lg overflow-hidden"
        style={{ border: `1px solid ${BORDER}` }}
      >
        {/* Header */}
        <div className="px-4 py-3 flex items-center gap-2" style={{ background: "var(--bg-tertiary)", borderBottom: `1px solid ${BORDER}` }}>
          <PillIcon />
          <h2
            className="text-sm font-semibold"
            style={{ color: NAVY, fontFamily: "Fraunces, Georgia, serif" }}
          >
            Affordable Alternatives
          </h2>
          <span className="text-xs ml-1" style={{ color: GREY_TEXT }}>
            Same composition, lower price
          </span>
        </div>

        {/* Scrollable row */}
        <div className="px-4 py-4 overflow-x-auto" style={{ background: "var(--bg-secondary)" }}>
          <div className="flex gap-3" style={{ minWidth: "max-content" }}>
            {substitutes.map((sub) => (
              <SubstituteCard
                key={sub.id}
                substitute={sub}
                currentPrice={currentPrice}
                countryCode={countryCode}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

// ---------- Single Card ----------

const SubstituteCard = ({
  substitute,
  countryCode,
}: {
  substitute: Substitute
  currentPrice: number
  countryCode: string
}) => {
  const hasMrp = substitute.mrp > substitute.unit_price
  const savingsDisplay = substitute.savings_pct > 0
    ? `${Math.round(substitute.savings_pct)}% cheaper`
    : null

  return (
    <Link
      to="/$countryCode/products/$handle"
      params={{ countryCode, handle: substitute.handle }}
      className="flex flex-col rounded-lg border p-3.5 hover:shadow-md transition-shadow cursor-pointer group"
      style={{
        borderColor: TEAL,
        background: TEAL_LIGHT,
        width: "200px",
        minWidth: "200px",
      }}
    >
      {/* Savings badge */}
      {savingsDisplay && (
        <span
          className="self-start inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold mb-2"
          style={{ background: GREEN_BG, color: GREEN }}
        >
          <ArrowDownIcon />
          {savingsDisplay}
        </span>
      )}

      {/* Product name */}
      <p
        className="text-sm font-semibold leading-tight mb-1 group-hover:underline"
        style={{ color: NAVY }}
      >
        {substitute.title}
      </p>

      {/* Generic name */}
      <p className="text-[11px] leading-snug mb-2" style={{ color: GREY_TEXT }}>
        {substitute.generic_name}
      </p>

      {/* Price */}
      <div className="mt-auto flex items-baseline gap-1.5">
        <span className="text-sm font-bold" style={{ color: TEAL }}>
          ₹{substitute.unit_price}
        </span>
        {hasMrp && (
          <span className="text-[11px] line-through" style={{ color: GREY_TEXT }}>
            ₹{substitute.mrp}
          </span>
        )}
      </div>
    </Link>
  )
}

// ---------- Icons ----------

const PillIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={TEAL} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M10.5 1.5L4.22 7.78a5.38 5.38 0 0 0 7.6 7.6l6.28-6.28a5.38 5.38 0 0 0-7.6-7.6z" />
    <line x1="8" y1="11" x2="13" y2="6" />
  </svg>
)

const ArrowDownIcon = () => (
  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className="mr-0.5">
    <polyline points="7 13 12 18 17 13" />
    <line x1="12" y1="18" x2="12" y2="6" />
  </svg>
)

export default ProductSubstitutes
