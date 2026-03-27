import { useState } from "react"
import { Link, useLocation } from "@tanstack/react-router"
import { getCountryCodeFromPath } from "@/lib/utils/region"
import {
  useWishlist,
  useRemoveFromWishlist,
  useToggleWishlistAlert,
  type WishlistItem,
} from "@/lib/hooks/use-wishlist"

const TEAL = "#0E7C86"
const NAVY = "#0D1B2A"

export default function WishlistPage() {
  const location = useLocation()
  const countryCode = getCountryCodeFromPath(location.pathname) || "in"
  const { data, isLoading, isError } = useWishlist()
  const removeMutation = useRemoveFromWishlist()
  const toggleAlert = useToggleWishlistAlert()

  const [removeConfirmId, setRemoveConfirmId] = useState<string | null>(null)
  // Local state for threshold inputs (before they're submitted)
  const [thresholdEdits, setThresholdEdits] = useState<Record<string, number>>({})

  const items = data?.wishlist ?? []

  const getPriceDropPct = (item: WishlistItem): number | null => {
    if (!item.price_at_addition || !item.current_price) return null
    if (item.current_price >= item.price_at_addition) return null
    return Math.round(((item.price_at_addition - item.current_price) / item.price_at_addition) * 100)
  }

  const formatRupees = (paise: number) =>
    `₹${(paise / 100).toLocaleString("en-IN", { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`

  const handleRemove = (id: string) => {
    const item = items.find((i) => i.id === id)
    if (!item) return
    removeMutation.mutate(
      { product_id: item.product_id },
      { onSuccess: () => setRemoveConfirmId(null) }
    )
  }

  const handleAlertToggle = (item: WishlistItem) => {
    toggleAlert.mutate({
      id: item.id,
      alert_enabled: !item.alert_enabled,
      alert_threshold_pct: thresholdEdits[item.id] ?? item.alert_threshold_pct,
    })
  }

  const handleThresholdBlur = (item: WishlistItem) => {
    const newVal = thresholdEdits[item.id]
    if (newVal === undefined || newVal === item.alert_threshold_pct) return
    toggleAlert.mutate({
      id: item.id,
      alert_enabled: item.alert_enabled,
      alert_threshold_pct: newVal,
    })
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <p className="text-sm" style={{ color: "#9CA3AF" }}>
          Loading wishlist...
        </p>
      </div>
    )
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1
            className="text-xl font-semibold"
            style={{ color: NAVY, fontFamily: "Fraunces, Georgia, serif" }}
          >
            My Wishlist
          </h1>
          <p className="text-sm mt-1" style={{ color: "#6B7280" }}>
            {items.length > 0
              ? `${items.length} saved product${items.length !== 1 ? "s" : ""}`
              : "Save products to buy later"}
          </p>
        </div>
      </div>

      {/* Error state */}
      {isError && (
        <div
          className="p-4 rounded-lg mb-6"
          style={{ background: "#FEF2F2", border: "1px solid #FECACA" }}
        >
          <p className="text-sm" style={{ color: "#B91C1C" }}>
            Failed to load wishlist. Please try again later.
          </p>
        </div>
      )}

      {/* Empty state */}
      {!isLoading && items.length === 0 && (
        <div
          className="text-center py-12 rounded-xl border"
          style={{ background: "#fff", borderColor: "#EDE9E1" }}
        >
          <div
            className="w-14 h-14 rounded-xl flex items-center justify-center mx-auto mb-4"
            style={{ background: "#FEF2F2", color: "#F87171" }}
          >
            <HeartOutlineIcon />
          </div>
          <h3 className="text-base font-semibold mb-1" style={{ color: NAVY }}>
            Your wishlist is empty
          </h3>
          <p className="text-sm mb-5 max-w-sm mx-auto" style={{ color: "#6B7280" }}>
            Save products you like and we'll notify you when the price drops.
          </p>
          <Link
            to="/$countryCode/store"
            params={{ countryCode }}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-semibold text-white transition-opacity hover:opacity-90"
            style={{ background: TEAL }}
          >
            Browse Products
          </Link>
        </div>
      )}

      {/* Wishlist grid */}
      {items.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {items.map((item) => {
            const dropPct = getPriceDropPct(item)
            const threshold = thresholdEdits[item.id] ?? item.alert_threshold_pct

            return (
              <WishlistCard
                key={item.id}
                item={item}
                countryCode={countryCode}
                dropPct={dropPct}
                threshold={threshold}
                formatRupees={formatRupees}
                onRemove={() => setRemoveConfirmId(item.id)}
                onAlertToggle={() => handleAlertToggle(item)}
                onThresholdChange={(val) =>
                  setThresholdEdits((prev) => ({ ...prev, [item.id]: val }))
                }
                onThresholdBlur={() => handleThresholdBlur(item)}
                isRemoving={removeMutation.isPending}
                isAlertPending={toggleAlert.isPending}
              />
            )
          })}
        </div>
      )}

      {/* Remove confirmation modal */}
      {removeConfirmId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-xl p-6 max-w-sm w-full mx-4 shadow-xl">
            <h3 className="text-base font-semibold mb-2" style={{ color: NAVY }}>
              Remove from wishlist?
            </h3>
            <p className="text-sm mb-5" style={{ color: "#6B7280" }}>
              This product will be removed from your wishlist. You can add it back any time.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setRemoveConfirmId(null)}
                className="flex-1 px-4 py-2 rounded-lg text-sm font-medium border"
                style={{ borderColor: "#D1D5DB", color: "#374151" }}
              >
                Cancel
              </button>
              <button
                onClick={() => handleRemove(removeConfirmId)}
                disabled={removeMutation.isPending}
                className="flex-1 px-4 py-2 rounded-lg text-sm font-semibold text-white disabled:opacity-60"
                style={{ background: "#B91C1C" }}
              >
                {removeMutation.isPending ? "Removing..." : "Remove"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

/* ── Wishlist card sub-component ── */

function WishlistCard({
  item,
  countryCode,
  dropPct,
  threshold,
  formatRupees,
  onRemove,
  onAlertToggle,
  onThresholdChange,
  onThresholdBlur,
  isRemoving,
  isAlertPending,
}: {
  item: WishlistItem
  countryCode: string
  dropPct: number | null
  threshold: number
  formatRupees: (paise: number) => string
  onRemove: () => void
  onAlertToggle: () => void
  onThresholdChange: (val: number) => void
  onThresholdBlur: () => void
  isRemoving: boolean
  isAlertPending: boolean
}) {
  return (
    <div
      className="rounded-xl border overflow-hidden flex flex-col"
      style={{ background: "#fff", borderColor: "#EDE9E1" }}
    >
      {/* Product image */}
      <div
        className="relative w-full aspect-square flex items-center justify-center"
        style={{ background: "#FAFAF8" }}
      >
        {item.thumbnail ? (
          <img
            src={item.thumbnail}
            alt={item.product_title ?? ""}
            className="w-full h-full object-contain p-4"
          />
        ) : (
          <PlaceholderImageIcon />
        )}

        {/* Price drop badge */}
        {dropPct !== null && dropPct > 0 && (
          <span
            className="absolute top-2 left-2 inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-bold text-white shadow-sm"
            style={{ background: "#16A34A" }}
          >
            <span>&#8595;</span> {dropPct}% drop
          </span>
        )}

        {/* Remove button */}
        <button
          onClick={onRemove}
          disabled={isRemoving}
          className="absolute top-2 right-2 p-1.5 rounded-full transition-colors hover:bg-red-50 disabled:opacity-50"
          style={{ background: "rgba(255,255,255,0.9)", color: "#9CA3AF" }}
          aria-label="Remove from wishlist"
        >
          <TrashIcon />
        </button>
      </div>

      {/* Card body */}
      <div className="p-3 flex flex-col gap-2 flex-1" style={{ borderTop: "1px solid #F3F0EB" }}>
        {/* Product title */}
        {item.product_handle ? (
          <Link
            to="/$countryCode/products/$handle"
            params={{ countryCode, handle: item.product_handle }}
            className="text-sm font-semibold leading-snug line-clamp-2 hover:underline"
            style={{ color: NAVY }}
          >
            {item.product_title ?? "Unknown product"}
          </Link>
        ) : (
          <p className="text-sm font-semibold leading-snug line-clamp-2" style={{ color: NAVY }}>
            {item.product_title ?? "Unknown product"}
          </p>
        )}

        {/* Price section */}
        <div className="flex items-end gap-2 flex-wrap">
          {item.current_price !== null ? (
            <span className="text-base font-bold" style={{ color: NAVY }}>
              {formatRupees(item.current_price)}
            </span>
          ) : null}
          {item.price_at_addition !== null &&
            item.current_price !== null &&
            item.price_at_addition !== item.current_price && (
              <span
                className="text-xs line-through"
                style={{ color: "#9CA3AF" }}
              >
                was {formatRupees(item.price_at_addition)}
              </span>
            )}
        </div>

        {/* Price alert toggle */}
        <div
          className="mt-auto pt-2 flex flex-col gap-1.5 border-t"
          style={{ borderColor: "#F3F0EB" }}
        >
          <div className="flex items-center gap-2">
            {/* Toggle switch */}
            <button
              role="switch"
              aria-checked={item.alert_enabled}
              onClick={onAlertToggle}
              disabled={isAlertPending}
              className="relative inline-flex h-5 w-9 flex-shrink-0 items-center rounded-full transition-colors focus:outline-none disabled:opacity-50"
              style={{
                background: item.alert_enabled ? TEAL : "#D1D5DB",
              }}
            >
              <span
                className="inline-block h-3.5 w-3.5 rounded-full bg-white shadow transform transition-transform"
                style={{
                  transform: item.alert_enabled ? "translateX(18px)" : "translateX(2px)",
                }}
              />
            </button>
            <span className="text-xs" style={{ color: "#374151" }}>
              Alert if price drops
            </span>
          </div>

          {item.alert_enabled && (
            <div className="flex items-center gap-1.5 pl-0.5">
              <span className="text-xs" style={{ color: "#6B7280" }}>by at least</span>
              <input
                type="number"
                min={1}
                max={50}
                value={threshold}
                onChange={(e) => onThresholdChange(Number(e.target.value))}
                onBlur={onThresholdBlur}
                className="w-14 px-2 py-1 rounded border text-xs text-center outline-none focus:ring-1"
                style={{ borderColor: "#D1D5DB", color: NAVY }}
              />
              <span className="text-xs" style={{ color: "#6B7280" }}>%</span>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

/* ── Icon helpers ── */

const HeartOutlineIcon = () => (
  <svg
    width="28"
    height="28"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
  </svg>
)

const TrashIcon = () => (
  <svg
    width="14"
    height="14"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <polyline points="3 6 5 6 21 6" />
    <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
    <path d="M10 11v6M14 11v6" />
    <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
  </svg>
)

const PlaceholderImageIcon = () => (
  <svg
    width="48"
    height="48"
    viewBox="0 0 24 24"
    fill="none"
    stroke="#D1D5DB"
    strokeWidth="1.5"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
    <circle cx="8.5" cy="8.5" r="1.5" />
    <polyline points="21 15 16 10 5 21" />
  </svg>
)
