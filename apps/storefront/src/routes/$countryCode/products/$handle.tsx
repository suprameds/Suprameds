import { listProducts, retrieveProduct } from "@/lib/data/products"
import { getRegion } from "@/lib/data/regions"
import { queryKeys } from "@/lib/utils/query-keys"
import { sdk } from "@/lib/utils/sdk"
import ProductDetails from "@/pages/product"
import { HttpTypes } from "@medusajs/types"
import { createFileRoute, notFound } from "@tanstack/react-router"

export const Route = createFileRoute("/$countryCode/products/$handle")({
  loader: async ({ params, context }) => {
    const { countryCode, handle } = params
    const { queryClient } = context

    const region = await queryClient.ensureQueryData({
      queryKey: ["region", countryCode],
      queryFn: () => getRegion({ country_code: countryCode }),
    })

    if (!region || !handle) {
      throw notFound()
    }

    // Single comprehensive product fetch with all needed fields
    const product = await queryClient.ensureQueryData({
      queryKey: ["product", handle, region.id],
      queryFn: async () => {
        try {
          return await retrieveProduct({
            handle,
            region_id: region.id,
            fields:
              "*variants, +variants.inventory_quantity, +variants.manage_inventory, +variants.allow_backorder, +variants.calculated_price, *images, *options, *options.values, *collection, *tags",
          })
        } catch {
          throw notFound()
        }
      },
    })

    // Fetch pharma metadata via custom endpoint using SDK (auto-includes publishable key + auth)
    let pharma: { drug_product: any } | null = null
    try {
      pharma = await sdk.client.fetch<{ drug_product: any }>(
        `/store/products/pharma?handle=${encodeURIComponent(handle)}`,
        { method: "GET" }
      )
    } catch {
      // pharma metadata unavailable — non-pharma product or module not loaded
    }

    if (pharma?.drug_product) {
      ;(product as any).drug_product = pharma.drug_product
    }

    // Pre-fetch related products for SSR hydration consistency.
    // Medusa v2: collection_id alone can 500 for some collections; tag_id is more reliable.
    // Use tag_id when available, else collection_id, else no filter. try/catch keeps page from crashing.
    await queryClient.ensureQueryData({
      queryKey: queryKeys.products.related(product.id, region.id),
      queryFn: async () => {
        try {
          const baseParams: HttpTypes.StoreProductListParams = {
            // `+variants.calculated_price` can break list endpoint parsing in Medusa v2.
            // Keep fields simple for related-products prefetch to avoid 500 responses.
            fields: "title, handle, *thumbnail, *variants",
            is_giftcard: false,
            limit: 4,
          }

          const filterParams: HttpTypes.StoreProductListParams =
            product.tags && product.tags.length > 0
              ? { ...baseParams, tag_id: product.tags.map((t) => t.id) }
              : product.collection_id
                ? { ...baseParams, collection_id: [product.collection_id] }
                : baseParams

          const { products } = await listProducts({
            query_params: filterParams,
            region_id: region.id,
          })

          return products.filter((p) => p.id !== product.id)
        } catch {
          return []
        }
      },
    })

    return {
      countryCode,
      region,
      product: product as HttpTypes.StoreProduct,
    }
  },
  head: ({ loaderData, params }) => {
    const { product, region } = loaderData || {}
    const siteUrl = import.meta.env.VITE_SITE_URL || "https://suprameds.in"
    const countryCode = params?.countryCode || "in"

    if (!product) {
      return {
        meta: [{ title: "Product Not Found | Suprameds" }],
      }
    }

    const canonical = `${siteUrl}/${countryCode}/products/${product.handle}`
    const title = `${product.title} | Suprameds`
    const desc = product.description || "Buy genuine medicines online from Suprameds."

    const firstVariant = product.variants?.[0]
    const isInStock =
      firstVariant &&
      (!firstVariant.manage_inventory || (firstVariant.inventory_quantity ?? 0) > 0)

    const structuredData = {
      "@context": "https://schema.org",
      "@type": "Product",
      name: product.title,
      description: product.description,
      image: product.images?.map((img) => img.url).filter(Boolean) || [],
      url: canonical,
      sku: firstVariant?.sku || product.id,
      brand: {
        "@type": "Brand",
        name: "Suprameds",
      },
      offers: {
        "@type": "Offer",
        url: canonical,
        availability: isInStock
          ? "https://schema.org/InStock"
          : "https://schema.org/OutOfStock",
        itemCondition: "https://schema.org/NewCondition",
        priceCurrency: region?.currency_code?.toUpperCase() || "INR",
        price: firstVariant?.calculated_price?.calculated_amount
          ? firstVariant.calculated_price.calculated_amount.toFixed(2)
          : undefined,
        seller: {
          "@type": "Organization",
          name: "Suprameds",
        },
      },
    }

    const breadcrumbSchema = {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: [
        {
          "@type": "ListItem",
          position: 1,
          name: "Home",
          item: `${siteUrl}/${countryCode}`,
        },
        {
          "@type": "ListItem",
          position: 2,
          name: "Store",
          item: `${siteUrl}/${countryCode}/store`,
        },
        ...(product.collection
          ? [{
              "@type": "ListItem",
              position: 3,
              name: product.collection.title,
              item: `${siteUrl}/${countryCode}/categories/${product.collection.handle}`,
            },
            {
              "@type": "ListItem",
              position: 4,
              name: product.title,
              item: canonical,
            }]
          : [{
              "@type": "ListItem",
              position: 3,
              name: product.title,
              item: canonical,
            }]),
      ],
    }

    const firstImageUrl = product.images?.[0]?.url || product.thumbnail

    return {
      meta: [
        { title },
        { name: "description", content: desc },
        { property: "og:title", content: title },
        { property: "og:description", content: desc },
        { property: "og:image", content: product.thumbnail || "" },
        { property: "og:url", content: canonical },
        { property: "og:type", content: "product" },
        { property: "twitter:card", content: "summary_large_image" },
        { property: "twitter:title", content: title },
        { property: "twitter:description", content: desc },
        { name: "twitter:image", content: product.thumbnail || "" },
      ],
      links: [
        { rel: "canonical", href: canonical },
        ...(firstImageUrl
          ? [{ rel: "preload", href: firstImageUrl, as: "image", fetchPriority: "high" as const }]
          : []),
      ],
      scripts: [
        { type: "application/ld+json", children: JSON.stringify(structuredData) },
        { type: "application/ld+json", children: JSON.stringify(breadcrumbSchema) },
      ],
    }
  },
  component: ProductDetails,
})
