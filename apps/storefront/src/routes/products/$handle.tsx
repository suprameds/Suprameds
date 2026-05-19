import { listProducts, retrieveProduct } from "@/lib/data/products"
import { getRegion } from "@/lib/data/regions"
import { queryKeys } from "@/lib/utils/query-keys"
import { sdk } from "@/lib/utils/sdk"
import ProductDetails from "@/pages/product"
import { ProductDetailSkeleton } from "@/components/ui/skeletons"
import { HttpTypes } from "@medusajs/types"
import { createFileRoute, notFound } from "@tanstack/react-router"
import { DEFAULT_COUNTRY_CODE } from "@/lib/constants/site"

export const Route = createFileRoute("/products/$handle")({
  // Allow ?pendingAction=add_to_cart:<variant_id> on the PDP URL so that
  // post-login round-trips can replay the original add-to-cart intent.
  // See: pages/product.tsx for the resume effect.
  validateSearch: (search: Record<string, unknown>): { pendingAction?: string } => ({
    pendingAction: typeof search.pendingAction === "string" ? search.pendingAction : undefined,
  }),
  loader: async ({ params, context }) => {
    const { handle } = params
    const { queryClient } = context

    const region = await queryClient.ensureQueryData({
      queryKey: ["region", DEFAULT_COUNTRY_CODE],
      queryFn: () => getRegion({ country_code: DEFAULT_COUNTRY_CODE }),
    })

    if (!region || !handle) {
      throw notFound()
    }

    // Fetch product and pharma metadata in parallel (both available after region resolves)
    const [product, pharma] = await Promise.all([
      queryClient.ensureQueryData({
        queryKey: ["product", handle, region.id],
        queryFn: async () => {
          try {
            return await retrieveProduct({
              handle,
              region_id: region.id,
              fields:
                "*variants, +variants.inventory_quantity, +variants.manage_inventory, +variants.allow_backorder, +variants.calculated_price, *images, *options, *options.values, *collection, *categories, *tags",
            })
          } catch {
            throw notFound()
          }
        },
      }),
      sdk.client.fetch<{ drug_product: any }>(
        `/store/products/pharma?handle=${encodeURIComponent(handle)}`,
        { method: "GET" }
      ).catch(() => null as { drug_product: any } | null),
    ])

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
      region,
      product: product as HttpTypes.StoreProduct,
    }
  },
  head: ({ loaderData }) => {
    const { product, region } = loaderData || {}
    const siteUrl = import.meta.env.VITE_SITE_URL || "https://supracyn.in"

    if (!product) {
      return {
        meta: [{ title: "Product Not Found | Suprameds" }],
      }
    }

    const canonical = `${siteUrl}/products/${product.handle}`
    const title = `${product.title} | Suprameds`
    const desc = product.description || "Buy genuine medicines online from Suprameds."

    const firstVariant = product.variants?.[0]
    const isInStock =
      firstVariant &&
      (!firstVariant.manage_inventory || (firstVariant.inventory_quantity ?? 0) > 0)

    // Schema.org Product `image` is REQUIRED for Google Merchant Listings rich
    // results. Many products in our catalog don't populate `product.images` but
    // do have a `thumbnail` — fall back to thumbnail (and de-dup) to ensure
    // every PDP emits at least one image URL.
    const productImageUrls = (product.images?.map((img) => img.url).filter(Boolean) ||
      []) as string[]
    const schemaImages =
      productImageUrls.length > 0
        ? productImageUrls
        : product.thumbnail
          ? [product.thumbnail]
          : []

    const structuredData = {
      "@context": "https://schema.org",
      "@type": "Product",
      name: product.title,
      description: product.description,
      image: schemaImages,
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
        // Free delivery over ₹300; 2-7 business days India-wide.
        // Matches the policy surfaced in the homepage FAQ and free-delivery
        // badge, so the schema does not drift from on-site claims.
        shippingDetails: {
          "@type": "OfferShippingDetails",
          shippingRate: {
            "@type": "MonetaryAmount",
            value: "0",
            currency: "INR",
          },
          shippingDestination: {
            "@type": "DefinedRegion",
            addressCountry: "IN",
          },
          deliveryTime: {
            "@type": "ShippingDeliveryTime",
            handlingTime: {
              "@type": "QuantitativeValue",
              minValue: 0,
              maxValue: 1,
              unitCode: "DAY",
            },
            transitTime: {
              "@type": "QuantitativeValue",
              minValue: 2,
              maxValue: 7,
              unitCode: "DAY",
            },
          },
        },
        // Per Indian pharma regulations medicines cannot be returned once
        // dispatched. Schema.org expresses this as MerchantReturnNotPermitted.
        // Damaged/incorrect-product replacements are handled through support
        // (see homepage FAQ) and are not a generic return policy.
        hasMerchantReturnPolicy: {
          "@type": "MerchantReturnPolicy",
          applicableCountry: "IN",
          returnPolicyCategory:
            "https://schema.org/MerchantReturnNotPermitted",
        },
      },
    }

    // Prefer product.categories (has real /categories/{handle} pages) over
    // product.collection (e.g. "Cardiology" collection has no storefront page,
    // so linking to /categories/cardiology 404s). Filter internal/inactive.
    const breadcrumbCategory = (product as unknown as {
      categories?: Array<{
        handle?: string
        name?: string
        is_internal?: boolean
        is_active?: boolean
      }>
    }).categories?.find(
      (c) => c?.handle && c.is_internal !== true && c.is_active !== false,
    )

    const breadcrumbSchema = {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: [
        {
          "@type": "ListItem",
          position: 1,
          name: "Home",
          item: `${siteUrl}`,
        },
        {
          "@type": "ListItem",
          position: 2,
          name: "Store",
          item: `${siteUrl}/store`,
        },
        ...(breadcrumbCategory
          ? [{
              "@type": "ListItem",
              position: 3,
              name: breadcrumbCategory.name,
              item: `${siteUrl}/categories/${breadcrumbCategory.handle}`,
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
  pendingComponent: ProductDetailSkeleton,
  component: ProductDetails,
})
