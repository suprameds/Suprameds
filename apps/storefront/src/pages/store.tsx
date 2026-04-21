import { ProductGridSkeleton } from "@/components/ui/skeletons"
import ProductCard from "@/components/product-card"
import { CATEGORY_ICON_MAP } from "@/components/search-category-chips"
import { Button } from "@/components/ui/button"
import { useProducts } from "@/lib/hooks/use-products"
import { useCategories } from "@/lib/hooks/use-categories"
import { useSearch, type SearchProduct } from "@/lib/hooks/use-search"
import { trackViewItemList } from "@/lib/utils/analytics"
import { useLoaderData, useSearch as useRouterSearch } from "@tanstack/react-router"
import { useMemo, useState, useEffect, useCallback } from "react"
import { useBulkPharma, usePharmaFilter, type DrugProductMeta } from "@/lib/hooks/use-pharma"
import { buildPharmaIdFilter } from "@/lib/utils/store-filters"
import { HttpTypes } from "@medusajs/types"

type ScheduleFilter = "all" | "rx" | "otc"

type EnrichedProduct = HttpTypes.StoreProduct & { drug_product?: DrugProductMeta }

function useDebouncedValue<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delayMs)
    return () => clearTimeout(timer)
  }, [value, delayMs])
  return debounced
}

const Store = () => {
  const { region } = useLoaderData({ from: "/store" })
  const searchParams = useRouterSearch({ strict: false }) as Record<string, string>
  const initialSchedule = (searchParams?.schedule as ScheduleFilter) || "all"
  const initialQuery = searchParams?.q || ""

  const [selectedCategory, setSelectedCategory] = useState<string | undefined>()
  const [selectedCategoryHandle, setSelectedCategoryHandle] = useState<string | undefined>()
  const [scheduleFilter, setScheduleFilter] = useState<ScheduleFilter>(initialSchedule)
  const [formFilter, setFormFilter] = useState<string>("all")

  // ── Search state (driven by navbar ?q= param) ──
  const [searchOffset, setSearchOffset] = useState(0)
  const debouncedSearch = useDebouncedValue(initialQuery.trim(), 300)
  const isSearchMode = debouncedSearch.length > 0

  // Fetch all categories for filter chips
  const { data: allCategories } = useCategories({
    fields: "id,name,handle,parent_category_id",
  })
  const medicinesParent = allCategories?.find((c) => c.handle === "medicines")
  const categories = medicinesParent
    ? allCategories?.filter((c) => c.parent_category_id === medicinesParent.id)
    : allCategories?.filter((c) => !c.parent_category_id)

  // ── Search mode: FTS via backend ──
  const { data: searchData, isFetching: isSearchFetching, isError: isSearchError } = useSearch({
    q: debouncedSearch,
    limit: 20,
    offset: searchOffset,
    categoryId: selectedCategoryHandle,
  })

  const searchProducts = searchData?.products ?? []
  const searchTotalCount = searchData?.count ?? 0
  const searchHasMore = searchOffset + 20 < searchTotalCount

  // Adapt FTS results to ProductCard shape
  const adaptedSearchProducts = searchProducts.map((p: SearchProduct) => ({
    ...p,
    drug_product: p.drug_product ?? undefined,
    variants: [],
  }))

  // ── Browse mode: Medusa product listing ──
  const hasPharmaFilter = scheduleFilter !== "all" || formFilter !== "all"
  const { data: filteredIds, isFetching: isFilterFetching } = usePharmaFilter(
    scheduleFilter !== "all" ? scheduleFilter : undefined,
    formFilter !== "all" ? formFilter : undefined,
  )

  const pharmaIdFilter = buildPharmaIdFilter({
    hasPharmaFilter,
    isFilterFetching,
    filteredIds,
  })

  const { data, fetchNextPage, hasNextPage, isFetchingNextPage, isFetching: isBrowseFetching, isError: isBrowseError, refetch } = useProducts({
    region_id: region?.id,
    query_params: {
      limit: 12,
      category_id: selectedCategory ? [selectedCategory] : undefined,
      ...(pharmaIdFilter ? { id: pharmaIdFilter } : {}),
    },
    enabled: !isSearchMode && (!hasPharmaFilter || !isFilterFetching),
  })

  const browseProducts = useMemo(() => data?.pages.flatMap((page) => page.products) || [], [data?.pages])

  // Fetch pharma metadata for browse mode
  const productIds = useMemo(() => browseProducts.map((p) => p.id).filter(Boolean), [browseProducts])
  const { data: pharmaMap, isFetching: isPharmaFetching } = useBulkPharma(productIds)

  const enrichedBrowseProducts = useMemo((): EnrichedProduct[] => {
    if (!pharmaMap) return browseProducts
    return browseProducts.map((p) => {
      const dp = pharmaMap[p.id]
      if (!dp) return p
      return { ...p, drug_product: dp }
    })
  }, [browseProducts, pharmaMap])

  // Dynamic dosage form filter options
  const availableForms = useMemo(() => {
    if (!pharmaMap) return []
    const forms = new Set<string>()
    for (const dp of Object.values(pharmaMap)) {
      if (dp.dosage_form) forms.add(dp.dosage_form.toLowerCase())
    }
    return Array.from(forms).sort()
  }, [pharmaMap])

  // ── Derived state ──
  const displayProducts = isSearchMode ? adaptedSearchProducts : enrichedBrowseProducts
  const isLoading = isSearchMode
    ? (isSearchFetching && searchProducts.length === 0)
    : (isBrowseFetching || isFilterFetching)
  const isError = isSearchMode ? isSearchError : isBrowseError
  const hasActiveFilters = hasPharmaFilter

  const clearAll = () => {
    setScheduleFilter("all")
    setFormFilter("all")
  }

  const handleCategorySelect = useCallback((catId: string | undefined, catHandle: string | undefined) => {
    if (selectedCategory === catId) {
      setSelectedCategory(undefined)
      setSelectedCategoryHandle(undefined)
    } else {
      setSelectedCategory(catId)
      setSelectedCategoryHandle(catHandle)
    }
    setSearchOffset(0)
  }, [selectedCategory])

  const loadMore = useCallback(() => {
    setSearchOffset((prev) => prev + 20)
  }, [])

  useEffect(() => {
    if (!isSearchMode && browseProducts.length) {
      trackViewItemList(browseProducts, "All Medicines", region?.currency_code?.toUpperCase() || "INR")
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [browseProducts.length, isSearchMode])

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
              { icon: "clock", text: "2-3 Days Delivery T.S. & A.P." },
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
        {/* Search bar removed — navbar already has one. Search state is
            driven by the ?q= URL param which the navbar search sets. */}

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
                className="px-3 py-2 rounded-full text-[11px] font-medium transition-colors"
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
          {availableForms.length > 0 && !isSearchMode && (
            <>
              <span className="text-[11px] font-medium mr-1" style={{ color: "var(--text-secondary)" }}>Form:</span>
              {["all", ...availableForms].map((val) => (
                <button
                  key={val}
                  onClick={() => setFormFilter(val)}
                  className="px-3 py-2 rounded-full text-[11px] font-medium transition-colors capitalize"
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

        {/* ── Category chips with icons ── */}
        {categories && categories.length > 0 && (
          <div className="flex overflow-x-auto md:flex-wrap gap-2 mb-6 pb-2 -mx-4 px-4 md:mx-0 md:px-0 no-scrollbar" style={{ WebkitOverflowScrolling: "touch" }}>
            <button
              onClick={() => handleCategorySelect(undefined, undefined)}
              className="flex-shrink-0 inline-flex items-center gap-1 px-4 py-2 rounded-full text-xs font-medium transition-colors min-h-[44px]"
              style={{
                background: !selectedCategory ? "var(--brand-teal)" : "var(--bg-secondary)",
                color: !selectedCategory ? "var(--text-inverse)" : "var(--text-primary)",
                border: `1px solid ${!selectedCategory ? "var(--brand-teal)" : "var(--border-primary)"}`,
              }}
            >
              All
            </button>
            {categories.map((cat) => {
              const icon = CATEGORY_ICON_MAP[cat.handle ?? ""]
              const isActive = selectedCategory === cat.id
              return (
                <button
                  key={cat.id}
                  onClick={() => handleCategorySelect(cat.id, cat.handle ?? undefined)}
                  className="flex-shrink-0 inline-flex items-center gap-1 px-4 py-2 rounded-full text-xs font-medium transition-colors min-h-[44px]"
                  style={{
                    background: isActive ? "var(--brand-teal)" : "var(--bg-secondary)",
                    color: isActive ? "var(--text-inverse)" : "var(--text-primary)",
                    border: `1px solid ${isActive ? "var(--brand-teal)" : "var(--border-primary)"}`,
                  }}
                >
                  {icon && <span>{icon}</span>}
                  {cat.name}
                </button>
              )
            })}
          </div>
        )}

        {/* ── Search results heading ── */}
        {isSearchMode && !isLoading && (
          <div className="flex items-baseline gap-2 mb-4">
            <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
              {searchTotalCount} result{searchTotalCount !== 1 ? "s" : ""} for <strong style={{ color: "var(--text-primary)" }}>"{debouncedSearch}"</strong>
              {selectedCategory && categories ? (() => {
                const cat = categories.find((c) => c.id === selectedCategory)
                return cat ? <> in <strong style={{ color: "var(--text-primary)" }}>{cat.name}</strong></> : null
              })() : null}
            </p>
          </div>
        )}

        {/* ── Browse result count ── */}
        {!isSearchMode && hasActiveFilters && !isLoading && (
          <p className="text-xs mb-4" style={{ color: "var(--text-secondary)" }}>
            Showing <strong style={{ color: "var(--text-primary)" }}>{displayProducts.length}</strong> medicine{displayProducts.length !== 1 ? "s" : ""}
          </p>
        )}

        {/* ── Products grid ── */}
        {isLoading && displayProducts.length === 0 ? (
          <ProductGridSkeleton count={8} />
        ) : isError ? (
          <div className="text-center py-16">
            <p className="text-sm mb-3" style={{ color: "var(--text-secondary)" }}>
              Something went wrong loading products.
            </p>
            {!isSearchMode && (
              <button
                onClick={() => refetch()}
                className="text-sm font-medium underline transition-opacity hover:opacity-70"
                style={{ color: "var(--brand-teal)" }}
              >
                Try again
              </button>
            )}
          </div>
        ) : displayProducts.length === 0 ? (
          <div className="text-center py-16">
            <p className="text-sm mb-3" style={{ color: "var(--text-secondary)" }}>
              {isSearchMode
                ? "No medicines found. Try a different search term."
                : `No medicines found${hasActiveFilters ? " matching your filters" : selectedCategory ? " in this category" : ""}.`}
            </p>
            {hasActiveFilters && !isSearchMode && (
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
              {displayProducts.map((product, idx) => (
                <ProductCard key={product.id} product={product as any} index={idx} pharmaLoading={!isSearchMode && isPharmaFetching && !(product as any).drug_product} />
              ))}
            </div>

            {/* Load more: different for search vs browse mode */}
            {isSearchMode ? (
              searchHasMore && (
                <div className="text-center mt-8">
                  <button
                    onClick={loadMore}
                    disabled={isSearchFetching}
                    className="px-6 py-2.5 rounded text-sm font-medium transition-all"
                    style={{
                      background: isSearchFetching ? "var(--border-primary)" : "var(--bg-secondary)",
                      color: "var(--text-primary)",
                      border: "1px solid var(--border-primary)",
                    }}
                  >
                    {isSearchFetching ? "Loading..." : "Load more results"}
                  </button>
                </div>
              )
            ) : (
              hasNextPage && (
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
              )
            )}
          </>
        )}
      </div>
    </div>
  )
}

export default Store
