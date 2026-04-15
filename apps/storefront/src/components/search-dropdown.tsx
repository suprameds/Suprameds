/* eslint-disable react-refresh/only-export-components */
import { useSearch, type SearchProduct } from "@/lib/hooks/use-search"
import { Link } from "@tanstack/react-router"
import { useState, useEffect } from "react"

const STORAGE_KEY = "suprameds_recent_searches"
const MAX_RECENTS = 5

type RecentSearch = { query: string; timestamp: number }

function getRecents(): RecentSearch[] {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]")
  } catch {
    return []
  }
}

export function saveRecentSearch(query: string) {
  const trimmed = query.trim().toLowerCase()
  if (!trimmed) return
  const recents = getRecents().filter((r) => r.query !== trimmed)
  recents.unshift({ query: trimmed, timestamp: Date.now() })
  localStorage.setItem(STORAGE_KEY, JSON.stringify(recents.slice(0, MAX_RECENTS)))
}

function removeRecent(query: string) {
  const recents = getRecents().filter((r) => r.query !== query)
  localStorage.setItem(STORAGE_KEY, JSON.stringify(recents))
}

function clearAllRecents() {
  localStorage.removeItem(STORAGE_KEY)
}

// ── Product suggestion row ──
function SuggestionRow({
  product,
  isHighlighted,
  countryCode,
  onMouseEnter,
  onClick,
}: {
  product: SearchProduct
  isHighlighted: boolean
  countryCode: string
  onMouseEnter: () => void
  onClick: () => void
}) {
  const drug = product.drug_product
  const isRx = drug?.schedule === "H" || drug?.schedule === "H1"

  return (
    <Link
      to="/$countryCode/products/$handle"
      params={{ countryCode, handle: product.handle }}
      onClick={(e) => { e.preventDefault(); onClick() }}
      onMouseEnter={onMouseEnter}
      className="flex items-center gap-3 px-3 py-2.5 transition-colors"
      style={{ background: isHighlighted ? "var(--bg-tertiary)" : "transparent" }}
    >
      {/* Thumbnail */}
      <div
        className="w-10 h-10 rounded-lg flex-shrink-0 flex items-center justify-center overflow-hidden"
        style={{ background: "var(--bg-primary)", border: "1px solid var(--border-primary)" }}
      >
        {product.thumbnail ? (
          <img src={product.thumbnail} alt={product.title} className="w-full h-full object-contain p-0.5" />
        ) : (
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--text-tertiary)" strokeWidth="1.5">
            <path d="m10.5 20.5 10-10a4.95 4.95 0 1 0-7-7l-10 10a4.95 4.95 0 1 0 7 7Z" />
            <line x1="8.5" y1="8.5" x2="15.5" y2="15.5" />
          </svg>
        )}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold truncate" style={{ color: "var(--text-primary)" }}>
          {product.title}
        </p>
        <p className="text-[11px] truncate" style={{ color: "var(--text-secondary)" }}>
          {[drug?.generic_name, drug?.strength, drug?.dosage_form].filter(Boolean).join(" · ")}
        </p>
      </div>

      {/* Rx badge */}
      {isRx && (
        <span
          className="text-[9px] font-bold px-1.5 py-0.5 rounded-full flex-shrink-0"
          style={{ background: "rgba(245,158,11,0.1)", color: "var(--brand-amber-dark)" }}
        >
          Rx
        </span>
      )}
    </Link>
  )
}

// ── Loading skeleton ──
function Skeleton() {
  return (
    <div className="px-3 py-2.5 flex items-center gap-3 animate-pulse">
      <div className="w-10 h-10 rounded-lg" style={{ background: "var(--border-primary)" }} />
      <div className="flex-1">
        <div className="h-3 rounded w-32 mb-1.5" style={{ background: "var(--border-primary)" }} />
        <div className="h-2.5 rounded w-20" style={{ background: "var(--border-secondary)" }} />
      </div>
    </div>
  )
}

// ── Main dropdown ──
export interface SearchDropdownProps {
  query: string
  isOpen: boolean
  highlightIndex: number
  onClose: () => void
  onSelectProduct: (handle: string) => void
  onSubmitSearch: (query: string) => void
  onSetHighlight: (index: number) => void
  onFillRecent: (query: string) => void
  countryCode: string
}

export function SearchDropdown({
  query,
  isOpen,
  highlightIndex,
  onSelectProduct,
  onSubmitSearch,
  onSetHighlight,
  onFillRecent,
  countryCode,
}: SearchDropdownProps) {
  const hasQuery = query.trim().length > 0
  const { data, isFetching } = useSearch({ q: query.trim(), limit: 5, offset: 0 })
  const [recents, setRecents] = useState<RecentSearch[]>([])
  const [hasMounted, setHasMounted] = useState(false)

  // Only load recents after hydration to avoid SSR mismatch
  useEffect(() => {
    setHasMounted(true)
  }, [])

  useEffect(() => {
    if (hasMounted && isOpen) setRecents(getRecents())
  }, [hasMounted, isOpen])

  const products = data?.products ?? []

  // Don't render empty container — only show when there's content
  if (!isOpen) return null
  if (!hasQuery && recents.length === 0) return null
  const totalCount = data?.count ?? 0
  const showRecents = !hasQuery && recents.length > 0
  const showResults = hasQuery
  const showEmpty = hasQuery && !isFetching && products.length === 0

  return (
    <div
      className="absolute top-full left-0 mt-2 rounded-xl overflow-hidden z-50"
      style={{
        background: "var(--bg-secondary)",
        border: "1px solid var(--border-primary)",
        boxShadow: "0 12px 48px rgba(0,0,0,0.12)",
        maxHeight: 420,
        overflowY: "auto",
        minWidth: 360,
        width: "100%",
      }}
      onMouseDown={(e) => e.preventDefault()}
    >
      {/* ── Recent searches ── */}
      {showRecents && (
        <>
          <div className="px-3 pt-3 pb-1 flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: "var(--text-tertiary)" }}>
              Recent Searches
            </span>
            <button
              type="button"
              onClick={() => { clearAllRecents(); setRecents([]) }}
              className="text-[10px] font-medium transition-opacity hover:opacity-70"
              style={{ color: "var(--brand-red)" }}
            >
              Clear all
            </button>
          </div>
          {recents.map((r, i) => (
            <button
              key={r.query}
              type="button"
              onClick={() => onFillRecent(r.query)}
              onMouseEnter={() => onSetHighlight(i)}
              className="w-full flex items-center gap-2.5 px-3 py-2 text-left transition-colors"
              style={{ background: highlightIndex === i ? "var(--bg-tertiary)" : "transparent" }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--text-tertiary)" strokeWidth="2">
                <circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" />
              </svg>
              <span className="text-sm flex-1" style={{ color: "var(--text-primary)" }}>{r.query}</span>
              <span
                onClick={(e) => {
                  e.stopPropagation()
                  removeRecent(r.query)
                  setRecents((prev) => prev.filter((x) => x.query !== r.query))
                }}
                className="text-[11px] transition-opacity hover:opacity-70 p-1"
                style={{ color: "var(--text-tertiary)" }}
              >
                ✕
              </span>
            </button>
          ))}
        </>
      )}

      {/* ── Live results ── */}
      {showResults && (
        <>
          <div className="px-3 pt-3 pb-1">
            <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: "var(--text-tertiary)" }}>
              {isFetching ? "Searching..." : `Medicines${totalCount > 0 ? ` · ${totalCount} found` : ""}`}
            </span>
          </div>

          {isFetching && products.length === 0 && (
            <>
              <Skeleton />
              <Skeleton />
              <Skeleton />
            </>
          )}

          {products.map((product, i) => (
            <SuggestionRow
              key={product.id}
              product={product}
              isHighlighted={highlightIndex === i}
              countryCode={countryCode}
              onMouseEnter={() => onSetHighlight(i)}
              onClick={() => onSelectProduct(product.handle)}
            />
          ))}

          {showEmpty && (
            <div className="px-3 py-6 text-center">
              <p className="text-sm" style={{ color: "var(--text-secondary)" }}>No medicines found for "{query.trim()}"</p>
            </div>
          )}


          {totalCount > 5 && (
            <button
              type="button"
              onClick={() => onSubmitSearch(query.trim())}
              onMouseEnter={() => onSetHighlight(products.length)}
              className="w-full flex items-center justify-center gap-1.5 px-3 py-2.5 text-sm font-semibold transition-colors"
              style={{
                color: "var(--brand-teal)",
                borderTop: "1px solid var(--border-primary)",
                background: highlightIndex === products.length ? "var(--bg-tertiary)" : "transparent",
              }}
            >
              See all {totalCount} results
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <line x1="5" y1="12" x2="19" y2="12" /><polyline points="12 5 19 12 12 19" />
              </svg>
            </button>
          )}
        </>
      )}
    </div>
  )
}
