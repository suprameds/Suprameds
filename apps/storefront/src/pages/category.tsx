import ProductGrid from "@/components/product-grid"
import { Button } from "@/components/ui/button"
import { ProductGridSkeleton } from "@/components/ui/product-card-skeleton"
import { useProducts } from "@/lib/hooks/use-products"
import { trackViewItemList } from "@/lib/utils/analytics"
import { Link, useLoaderData } from "@tanstack/react-router"
import { useEffect } from "react"

/**
 * Category Page Pattern
 *
 * Demonstrates:
 * - useLoaderData for SSR-loaded category and region
 * - useProducts with category_id filter
 * - Filtering products by category
 */
const Category = () => {
  const { category, region, countryCode } = useLoaderData({
    from: "/$countryCode/categories/$handle",
  })

  const { data, fetchNextPage, hasNextPage, isFetchingNextPage, isFetching } = useProducts({
    region_id: region?.id,
    query_params: {
      category_id: category?.id ? [category.id] : undefined,
      limit: 12,
    },
  })

  const products = data?.pages.flatMap((page) => page.products) || []

  useEffect(() => {
    if (products.length && category?.name) {
      trackViewItemList(products, category.name, region?.currency_code?.toUpperCase() || "INR")
    }
  }, [products.length, category?.name])

  return (
    <div style={{ background: "var(--bg-tertiary)", minHeight: "60vh" }}>
      {/* Header */}
      <div style={{ background: "var(--bg-inverse)" }}>
        <div className="content-container py-8 lg:py-10">
          <p className="text-xs font-medium uppercase tracking-wider mb-2" style={{ color: "rgba(255,255,255,0.5)" }}>
            Category
          </p>
          <h1
            className="text-2xl lg:text-3xl font-semibold"
            style={{ color: "var(--text-inverse)", fontFamily: "Fraunces, Georgia, serif" }}
          >
            {category?.name || "Category"}
          </h1>
        </div>
      </div>

      <div className="content-container py-8">
        {isFetching && products.length === 0 ? (
          <ProductGridSkeleton count={8} />
        ) : products.length === 0 ? (
          /* Empty state */
          <div className="text-center py-16 flex flex-col items-center gap-4">
            <svg
              width="48"
              height="48"
              viewBox="0 0 24 24"
              fill="none"
              stroke="var(--border-primary)"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="m10.5 20.5 10-10a4.95 4.95 0 1 0-7-7l-10 10a4.95 4.95 0 1 0 7 7Z" />
              <line x1="8.5" y1="8.5" x2="15.5" y2="15.5" />
            </svg>
            <p className="text-lg font-medium" style={{ color: "var(--text-primary)" }}>
              No products found
            </p>
            <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
              There are no products in this category yet.
            </p>
            <Link
              to="/$countryCode/store"
              params={{ countryCode: countryCode || "in" }}
              className="inline-flex px-5 py-2.5 rounded text-sm font-semibold transition-opacity hover:opacity-90 mt-2"
              style={{ background: "var(--brand-teal)", color: "var(--text-inverse)" }}
            >
              Browse All Medicines
            </Link>
          </div>
        ) : (
          <>
            <ProductGrid products={products} className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4" />

            {hasNextPage && (
              <div className="mt-8 text-center">
                <Button
                  onClick={() => fetchNextPage()}
                  disabled={isFetchingNextPage}
                  variant="secondary"
                  className="mt-6"
                >
                  {isFetchingNextPage ? "Loading..." : "Load More"}
                </Button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}

export default Category
