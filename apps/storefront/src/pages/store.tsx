import ProductCard from "@/components/product-card"
import { Button } from "@/components/ui/button"
import { useProducts } from "@/lib/hooks/use-products"
import { useCategories } from "@/lib/hooks/use-categories"
import { trackViewItemList } from "@/lib/utils/analytics"
import { useLoaderData, useSearch } from "@tanstack/react-router"
import { useMemo, useState, useEffect } from "react"
import { useBulkPharma, usePharmaFilter, type DrugProductMeta } from "@/lib/hooks/use-pharma"
import { HttpTypes } from "@medusajs/types"

type ScheduleFilter = "all" | "rx" | "otc"

type EnrichedProduct = HttpTypes.StoreProduct & { drug_product?: DrugProductMeta }

const Store = () => {
  const { region } = useLoaderData({ from: "/$countryCode/store" })
  const searchParams = useSearch({ strict: false }) as Record<string, string>
  const initialSchedule = (searchParams?.schedule as ScheduleFilter) || "all"

  const [selectedCategory, setSelectedCategory] = useState<string | undefined>()
  const [scheduleFilter, setScheduleFilter] = useState<ScheduleFilter>(initialSchedule)
  const [formFilter, setFormFilter] = useState<string>("all")

  const { data: categories } = useCategories({
    fields: "id,name,handle",
    queryParams: { parent_category_id: "null", limit: 12 },
  })

  // Server-side pharma filter: returns matching product_ids for schedule/form
  const hasPharmaFilter = scheduleFilter !== "all" || formFilter !== "all"
  const { data: filteredIds, isFetching: isFilterFetching } = usePharmaFilter(
    scheduleFilter !== "all" ? scheduleFilter : undefined,
    formFilter !== "all" ? formFilter : undefined,
  )

  // Pass filtered IDs to Medusa's paginated product list
  // When pharma filter is active but returns 0 results, pass a dummy ID to get 0 products
  const pharmaIdFilter = hasPharmaFilter
    ? (filteredIds && filteredIds.length > 0 ? filteredIds : ["__none__"])
    : undefined

  const { data, fetchNextPage, hasNextPage, isFetchingNextPage, isFetching, isError, refetch } = useProducts({
    region_id: region?.id,
    query_params: {
      limit: 12,
      category_id: selectedCategory ? [selectedCategory] : undefined,
      ...(pharmaIdFilter ? { id: pharmaIdFilter } : {}),
    },
  })

  const products = data?.pages.flatMap((page) => page.products) || []

  // Fetch pharma metadata for display (MRP, manufacturer, etc.)
  const productIds = useMemo(() => products.map((p) => p.id).filter(Boolean), [products])
  const { data: pharmaMap } = useBulkPharma(productIds)

  // Enrich products with pharma data for display
  const enrichedProducts = useMemo((): EnrichedProduct[] => {
    if (!pharmaMap) return products
    return products.map((p) => {
      const dp = pharmaMap[p.id]
      if (!dp) return p
      return { ...p, drug_product: dp }
    })
  }, [products, pharmaMap])

  // Build dynamic form filter options from ALL pharma data (not just loaded page)
  // We fetch distinct forms from the bulk pharma response
  const availableForms = useMemo(() => {
    if (!pharmaMap) return []
    const forms = new Set<string>()
    for (const dp of Object.values(pharmaMap)) {
      if (dp.dosage_form) forms.add(dp.dosage_form.toLowerCase())
    }
    return Array.from(forms).sort()
  }, [pharmaMap])

  const hasActiveFilters = hasPharmaFilter
  const displayCount = enrichedProducts.length
  const isLoading = isFetching || isFilterFetching

  const clearAll = () => {
    setScheduleFilter("all")
    setFormFilter("all")
  }

  useEffect(() => {
    if (products.length) {
      trackViewItemList(products, "All Medicines", region?.currency_code?.toUpperCase() || "INR")
    }
  }, [products.length])

  return (
    <div style={{ background: "var(--bg-primary)", minHeight: "80vh" }}>
      {/* Header */}
      <div style={{ background: "var(--bg-inverse)" }}>
        <div className="content-container py-8 lg:py-10">
          <h1
            className="text-2xl lg:text-3xl font-semibold mb-2"
            style={{ color: "var(--text-inverse)", fontFamily: "Fraunces, Georgia, serif" }}
          >
            All Medicines
          </h1>
          <p className="text-sm mb-5" style={{ color: "rgba(255,255,255,0.6)" }}>
            Same composition. Same efficacy. 50–80% less than branded alternatives.
          </p>
          <div className="flex flex-wrap gap-3">
            {[
              { icon: "tag", text: "50–80% Off" },
              { icon: "truck", text: "Free Delivery ₹300+" },
              { icon: "clock", text: "2-Day Delivery T.S. & A.P." },
            ].map((badge) => (
              <span
                key={badge.text}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium"
                style={{ background: "rgba(14,124,134,0.2)", color: "var(--brand-teal-light)" }}
              >
                {badge.icon === "tag" && (
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M20.59 13.41l-7.17 7.17a2 2 0 01-2.83 0L2 12V2h10l8.59 8.59a2 2 0 010 2.82z"/><line x1="7" y1="7" x2="7.01" y2="7"/></svg>
                )}
                {badge.icon === "truck" && (
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><rect x="1" y="3" width="15" height="13"/><polygon points="16 8 20 8 23 11 23 16 16 16 16 8"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/></svg>
                )}
                {badge.icon === "clock" && (
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                )}
                {badge.text}
              </span>
            ))}
          </div>
        </div>
      </div>

      <div className="content-container py-8">
        {/* ── Filter chips ── */}
        <div className="flex flex-wrap items-center gap-2 mb-4">
          {/* Schedule type filter */}
          <span className="text-[11px] font-medium mr-1" style={{ color: "var(--text-secondary)" }}>Type:</span>
          {(["all", "rx", "otc"] as ScheduleFilter[]).map((val) => {
            const labels: Record<ScheduleFilter, string> = { all: "All", rx: "Rx Only", otc: "OTC" }
            return (
              <button
                key={val}
                onClick={() => setScheduleFilter(val)}
                className="px-2.5 py-1 rounded-full text-[11px] font-medium transition-colors"
                style={{
                  background: scheduleFilter === val ? (val === "rx" ? "var(--brand-amber)" : val === "otc" ? "var(--brand-teal)" : "var(--bg-inverse)") : "var(--bg-secondary)",
                  color: scheduleFilter === val ? "var(--text-inverse)" : "var(--text-primary)",
                  border: `1px solid ${scheduleFilter === val ? "transparent" : "var(--border-primary)"}`,
                }}
              >
                {labels[val]}
              </button>
            )
          })}

          <span className="w-px h-4 mx-1" style={{ background: "var(--border-primary)" }} />

          {/* Dosage form filter (dynamic from loaded products) */}
          {availableForms.length > 0 && (
            <>
              <span className="text-[11px] font-medium mr-1" style={{ color: "var(--text-secondary)" }}>Form:</span>
              {["all", ...availableForms].map((val) => (
                <button
                  key={val}
                  onClick={() => setFormFilter(val)}
                  className="px-2.5 py-1 rounded-full text-[11px] font-medium transition-colors capitalize"
                  style={{
                    background: formFilter === val ? "var(--brand-teal)" : "var(--bg-secondary)",
                    color: formFilter === val ? "var(--text-inverse)" : "var(--text-primary)",
                    border: `1px solid ${formFilter === val ? "transparent" : "var(--border-primary)"}`,
                  }}
                >
                  {val === "all" ? "All" : val}
                </button>
              ))}
            </>
          )}

          {hasActiveFilters && (
            <>
              <span className="w-px h-4 mx-1" style={{ background: "var(--border-primary)" }} />
              <button
                onClick={clearAll}
                className="px-2.5 py-1 rounded-full text-[11px] font-medium transition-colors"
                style={{ color: "var(--brand-red)", background: "rgba(239,68,68,0.06)", border: "1px solid rgba(239,68,68,0.15)" }}
              >
                Clear All
              </button>
            </>
          )}
        </div>

        {/* Category quick-filters */}
        {categories && categories.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-6">
            <button
              onClick={() => setSelectedCategory(undefined)}
              className="px-4 py-2 rounded-full text-xs font-medium transition-colors min-h-[44px]"
              style={{
                background: !selectedCategory ? "var(--brand-teal)" : "var(--bg-secondary)",
                color: !selectedCategory ? "var(--text-inverse)" : "var(--text-primary)",
                border: `1px solid ${!selectedCategory ? "var(--brand-teal)" : "var(--border-primary)"}`,
              }}
            >
              All
            </button>
            {categories.map((cat) => (
              <button
                key={cat.id}
                onClick={() => setSelectedCategory(selectedCategory === cat.id ? undefined : cat.id)}
                className="px-4 py-2 rounded-full text-xs font-medium transition-colors min-h-[44px]"
                style={{
                  background: selectedCategory === cat.id ? "var(--brand-teal)" : "var(--bg-secondary)",
                  color: selectedCategory === cat.id ? "var(--text-inverse)" : "var(--text-primary)",
                  border: `1px solid ${selectedCategory === cat.id ? "var(--brand-teal)" : "var(--border-primary)"}`,
                }}
              >
                {cat.name}
              </button>
            ))}
          </div>
        )}

        {/* Result count */}
        {hasActiveFilters && !isLoading && (
          <p className="text-xs mb-4" style={{ color: "var(--text-secondary)" }}>
            Showing <strong style={{ color: "var(--text-primary)" }}>{displayCount}</strong> medicine{displayCount !== 1 ? "s" : ""}
          </p>
        )}

        {/* Products grid */}
        {isLoading && products.length === 0 ? (
          <div className="flex items-center justify-center py-16">
            <div
              className="w-6 h-6 border-2 rounded-full animate-spin"
              style={{ borderColor: "var(--border-primary)", borderTopColor: "var(--brand-teal)" }}
            />
          </div>
        ) : isError ? (
          <div className="text-center py-16">
            <p className="text-sm mb-3" style={{ color: "var(--text-secondary)" }}>
              Something went wrong loading products.
            </p>
            <button
              onClick={() => refetch()}
              className="text-sm font-medium underline transition-opacity hover:opacity-70"
              style={{ color: "var(--brand-teal)" }}
            >
              Try again
            </button>
          </div>
        ) : enrichedProducts.length === 0 ? (
          <div className="text-center py-16">
            <p className="text-sm mb-3" style={{ color: "var(--text-secondary)" }}>
              No medicines found{hasActiveFilters ? " matching your filters" : selectedCategory ? " in this category" : ""}.
            </p>
            {hasActiveFilters && (
              <button
                onClick={clearAll}
                className="text-sm font-medium underline transition-opacity hover:opacity-70"
                style={{ color: "var(--brand-teal)" }}
              >
                Clear all filters
              </button>
            )}
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
              {enrichedProducts.map((product) => (
                <ProductCard key={product.id} product={product} />
              ))}
            </div>

            {hasNextPage && (
              <div className="text-center mt-8">
                <Button
                  onClick={() => fetchNextPage()}
                  disabled={isFetchingNextPage}
                  variant="secondary"
                  size="fit"
                >
                  {isFetchingNextPage ? "Loading..." : "Load More Medicines"}
                </Button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}

export default Store
