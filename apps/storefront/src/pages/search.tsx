import ProductCard from "@/components/product-card"
import { useSearch, type SearchProduct } from "@/lib/hooks/use-search"
import { Link, useLoaderData, useNavigate } from "@tanstack/react-router"
import { useState, useEffect, useRef, useCallback } from "react"

const SearchIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
  </svg>
)

/**
 * Debounce hook — returns a debounced version of the value.
 */
function useDebouncedValue<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value)

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delayMs)
    return () => clearTimeout(timer)
  }, [value, delayMs])

  return debounced
}

const RESULTS_PER_PAGE = 20

const Search = () => {
  const { countryCode, q } = useLoaderData({ from: "/$countryCode/search" })
  const navigate = useNavigate()

  const [input, setInput] = useState(q || "")
  const [offset, setOffset] = useState(0)

  // Sync input when URL query param changes (e.g. navbar submit)
  const prevQ = useRef(q)
  useEffect(() => {
    if (q !== prevQ.current) {
      setInput(q || "")
      setOffset(0)
      prevQ.current = q
    }
  }, [q])

  // Debounce input for as-you-type search (300ms)
  const debouncedInput = useDebouncedValue(input.trim(), 300)

  const { data, isFetching, isError } = useSearch({
    q: debouncedInput,
    limit: RESULTS_PER_PAGE,
    offset,
  })

  const products = data?.products ?? []
  const totalCount = data?.count ?? 0
  const hasMore = offset + RESULTS_PER_PAGE < totalCount

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const trimmed = input.trim()
    if (trimmed) {
      setOffset(0)
      navigate({
        to: "/$countryCode/search",
        params: { countryCode },
        search: { q: trimmed },
      })
    }
  }

  const loadMore = useCallback(() => {
    setOffset((prev) => prev + RESULTS_PER_PAGE)
  }, [])

  // Adapt FTS results to the shape ProductCard expects (StoreProduct-like)
  const adaptedProducts = products.map((p: SearchProduct) => ({
    ...p,
    drug_product: p.drug_product ?? undefined,
    variants: [],
  }))

  const showResults = debouncedInput.length > 0
  const isSearching = isFetching && products.length === 0

  return (
    <div style={{ background: "#F8F6F2", minHeight: "60vh" }}>
      <div className="content-container py-8">
        {/* Search input */}
        <form onSubmit={handleSubmit} className="max-w-2xl mx-auto mb-10">
          <div
            className="flex items-center rounded-xl overflow-hidden shadow-sm"
            style={{ background: "#fff", border: "1px solid #EDE9E1" }}
          >
            <div className="pl-4" style={{ color: "#999" }}>
              <SearchIcon />
            </div>
            <input
              type="text"
              value={input}
              onChange={(e) => {
                setInput(e.target.value)
                setOffset(0)
              }}
              placeholder="Search medicines by name, composition, or generic name..."
              className="flex-1 px-3 py-3.5 text-sm outline-none bg-transparent"
              style={{ color: "#0D1B2A" }}
              autoFocus
            />
            {isFetching && (
              <div className="pr-2">
                <div
                  className="w-4 h-4 border-2 rounded-full animate-spin"
                  style={{ borderColor: "#EDE9E1", borderTopColor: "#0E7C86" }}
                />
              </div>
            )}
            <button
              type="submit"
              className="px-5 py-3.5 text-sm font-semibold transition-opacity hover:opacity-90"
              style={{ background: "#0E7C86", color: "#fff" }}
            >
              Search
            </button>
          </div>
        </form>

        {/* Results */}
        {showResults ? (
          <>
            <div className="flex items-baseline gap-2 mb-6">
              <h1
                className="text-xl font-semibold"
                style={{ color: "#0D1B2A", fontFamily: "Fraunces, Georgia, serif" }}
              >
                {isSearching ? "Searching..." : `Results for "${debouncedInput}"`}
              </h1>
              {!isSearching && (
                <span className="text-sm" style={{ color: "#999" }}>
                  ({totalCount} found)
                </span>
              )}
            </div>

            {isError ? (
              <div className="text-center py-16">
                <p className="text-lg font-medium mb-2" style={{ color: "#C0392B" }}>
                  Search failed
                </p>
                <p className="text-sm" style={{ color: "#666" }}>
                  Something went wrong. Please try a different search term.
                </p>
              </div>
            ) : isSearching ? (
              <div className="flex items-center justify-center py-20">
                <div
                  className="w-8 h-8 border-2 rounded-full animate-spin"
                  style={{ borderColor: "#EDE9E1", borderTopColor: "#0E7C86" }}
                />
              </div>
            ) : products.length === 0 ? (
              <div className="text-center py-16">
                <p className="text-lg font-medium mb-2" style={{ color: "#0D1B2A" }}>
                  No medicines found
                </p>
                <p className="text-sm mb-6" style={{ color: "#666" }}>
                  Try a different search term, or browse all medicines.
                </p>
                <Link
                  to="/$countryCode/store"
                  params={{ countryCode }}
                  className="inline-flex px-5 py-2.5 rounded text-sm font-semibold transition-opacity hover:opacity-90"
                  style={{ background: "#0E7C86", color: "#fff" }}
                >
                  Browse All Medicines
                </Link>
              </div>
            ) : (
              <>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {adaptedProducts.map((product) => (
                    <ProductCard key={product.id} product={product as any} />
                  ))}
                </div>

                {hasMore && (
                  <div className="mt-8 text-center">
                    <button
                      onClick={loadMore}
                      disabled={isFetching}
                      className="px-6 py-2.5 rounded text-sm font-medium transition-all"
                      style={{
                        background: isFetching ? "#EDE9E1" : "#fff",
                        color: "#0D1B2A",
                        border: "1px solid #EDE9E1",
                      }}
                    >
                      {isFetching ? "Loading..." : "Load more results"}
                    </button>
                  </div>
                )}
              </>
            )}
          </>
        ) : (
          <div className="text-center py-16">
            <h1
              className="text-2xl font-semibold mb-3"
              style={{ color: "#0D1B2A", fontFamily: "Fraunces, Georgia, serif" }}
            >
              Search medicines
            </h1>
            <p className="text-sm mb-6" style={{ color: "#666" }}>
              Enter a medicine name, composition, or generic name above.
            </p>
            <Link
              to="/$countryCode/store"
              params={{ countryCode }}
              className="inline-flex px-5 py-2.5 rounded text-sm font-semibold transition-opacity hover:opacity-90"
              style={{ background: "#0E7C86", color: "#fff" }}
            >
              Browse All Medicines
            </Link>
          </div>
        )}
      </div>
    </div>
  )
}

export default Search
