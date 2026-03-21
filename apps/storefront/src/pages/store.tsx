import ProductCard from "@/components/product-card"
import { Button } from "@/components/ui/button"
import { useProducts } from "@/lib/hooks/use-products"
import { useCategories } from "@/lib/hooks/use-categories"
import { useLoaderData } from "@tanstack/react-router"
import { useState } from "react"

const Store = () => {
  const { region } = useLoaderData({ from: "/$countryCode/store" })
  const [selectedCategory, setSelectedCategory] = useState<string | undefined>()

  const { data: categories } = useCategories({
    fields: "id,name,handle",
    queryParams: { parent_category_id: "null", limit: 12 },
  })

  const { data, fetchNextPage, hasNextPage, isFetchingNextPage, isFetching } = useProducts({
    region_id: region?.id,
    query_params: {
      limit: 12,
      category_id: selectedCategory ? [selectedCategory] : undefined,
    },
  })

  const products = data?.pages.flatMap((page) => page.products) || []

  return (
    <div style={{ background: "#FAFAF8", minHeight: "80vh" }}>
      {/* Header */}
      <div style={{ background: "#0D1B2A" }}>
        <div className="content-container py-8 lg:py-10">
          <h1
            className="text-2xl lg:text-3xl font-semibold mb-2"
            style={{ color: "#fff", fontFamily: "Fraunces, Georgia, serif" }}
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
                style={{ background: "rgba(14,124,134,0.2)", color: "#16a5b0" }}
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
        {/* Category quick-filters */}
        {categories && categories.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-6">
            <button
              onClick={() => setSelectedCategory(undefined)}
              className="px-3 py-1.5 rounded-full text-xs font-medium transition-colors"
              style={{
                background: !selectedCategory ? "#0E7C86" : "#fff",
                color: !selectedCategory ? "#fff" : "#0D1B2A",
                border: `1px solid ${!selectedCategory ? "#0E7C86" : "#EDE9E1"}`,
              }}
            >
              All
            </button>
            {categories.map((cat) => (
              <button
                key={cat.id}
                onClick={() => setSelectedCategory(selectedCategory === cat.id ? undefined : cat.id)}
                className="px-3 py-1.5 rounded-full text-xs font-medium transition-colors"
                style={{
                  background: selectedCategory === cat.id ? "#0E7C86" : "#fff",
                  color: selectedCategory === cat.id ? "#fff" : "#0D1B2A",
                  border: `1px solid ${selectedCategory === cat.id ? "#0E7C86" : "#EDE9E1"}`,
                }}
              >
                {cat.name}
              </button>
            ))}
          </div>
        )}

        {/* Products grid */}
        {isFetching && products.length === 0 ? (
          <div className="flex items-center justify-center py-16">
            <div
              className="w-6 h-6 border-2 rounded-full animate-spin"
              style={{ borderColor: "#EDE9E1", borderTopColor: "#0E7C86" }}
            />
          </div>
        ) : products.length === 0 ? (
          <div className="text-center py-16">
            <p className="text-sm" style={{ color: "#666" }}>
              No medicines found{selectedCategory ? " in this category" : ""}. Try a different filter.
            </p>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
              {products.map((product) => (
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
