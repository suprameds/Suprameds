import ProductGrid from "@/components/product-grid"
import { Button } from "@/components/ui/button"
import { useProducts } from "@/lib/hooks/use-products"
import { trackViewItemList } from "@/lib/utils/analytics"
import { useLoaderData } from "@tanstack/react-router"
import { useEffect } from "react"

const Category = () => {
  const { category, region } = useLoaderData({
    from: "/categories/$handle",
  })

  const { data, fetchNextPage, hasNextPage, isFetchingNextPage, isFetching, isError, refetch } = useProducts({
    region_id: region?.id,
    query_params: {
      category_id: category?.id ? [category.id] : undefined,
      limit: 12,
    },
  })

  const products = data?.pages.flatMap((page) => page.products) || []
  const categoryName = category?.name || "Category"
  const productCount = products.length

  useEffect(() => {
    if (products.length && category?.name) {
      trackViewItemList(products, category.name, region?.currency_code?.toUpperCase() || "INR")
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [products.length, category?.name])

  // Use category.description if pharmacist/admin has filled it in,
  // otherwise fall back to a templated intro so every category page has
  // unique-ish content (avoids "thin content" deprioritization in Google).
  const introText = category?.description?.trim() ||
    `Browse ${categoryName.toLowerCase()} medicines from India's licensed online pharmacy. ` +
    `Every product is sourced from CDSCO-approved manufacturers, dispensed by registered pharmacists, ` +
    `and shipped via Speed Post across India. Save 50–80% off MRP on generic alternatives with the same active ingredients as branded medicines.`

  return (
    <div className="content-container py-6">
      <header className="mb-6">
        <h1 className="text-2xl lg:text-3xl font-semibold mb-3" style={{ fontFamily: "var(--font-serif, Fraunces, serif)", color: "var(--suprameds-navy, #1E2D5A)" }}>
          {categoryName}
        </h1>
        <p className="text-sm leading-relaxed max-w-3xl" style={{ color: "var(--text-secondary)" }}>
          {introText}
        </p>
        {productCount > 0 && (
          <p className="mt-2 text-xs" style={{ color: "var(--text-tertiary)" }}>
            {productCount}{hasNextPage ? "+" : ""} {productCount === 1 ? "medicine" : "medicines"} available
          </p>
        )}
      </header>

      {isFetching && products.length === 0 ? (
        <div className="text-[var(--text-secondary)]">Loading...</div>
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
      ) : products.length === 0 ? (
        <div className="text-[var(--text-secondary)]">No products found</div>
      ) : (
        <>
          <ProductGrid products={products} className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 sm:gap-4" />

          {hasNextPage && (
            <Button
              onClick={() => fetchNextPage()}
              disabled={isFetchingNextPage}
              variant="secondary"
              className="mt-6"
            >
              {isFetchingNextPage ? "Loading..." : "Load More"}
            </Button>
          )}
        </>
      )}
    </div>
  )
}

export default Category
