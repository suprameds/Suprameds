import { createFileRoute, notFound } from "@tanstack/react-router"
import { getRegion } from "@/lib/data/regions"
import Store from "@/pages/store"
import { listProducts } from "@/lib/data/products"
import { HttpTypes } from "@medusajs/types"

type StoreSearchParams = {
  q?: string
  schedule?: string
}

export const Route = createFileRoute("/$countryCode/store")({
  validateSearch: (search: Record<string, unknown>): StoreSearchParams => ({
    q: typeof search.q === "string" ? search.q : undefined,
    schedule: typeof search.schedule === "string" ? search.schedule : undefined,
  }),
  loader: async ({ params, context }) => {
    const { countryCode } = params
    const { queryClient } = context

    const region = await queryClient.ensureQueryData({
      queryKey: ["region", countryCode],
      queryFn: () => getRegion({ country_code: countryCode }),
    })

    if (!region) {
      throw notFound()
    }

    const { products } = await queryClient.ensureQueryData({
      queryKey: ["products", { region_id: region.id }],
      queryFn: () => listProducts({
        query_params: {
          limit: 100, // Reduce limit for SSR performance
          order: "-created_at"
        },
        region_id: region.id,
      }),
    })

    return {
      countryCode,
      region,
      products: products as HttpTypes.StoreProduct[],
    }
  },
  head: ({ loaderData, params }) => {
    const { region } = loaderData || {}
    const siteUrl = import.meta.env.VITE_SITE_URL || "https://suprameds.in"
    const countryCode = params?.countryCode || "in"
    const regionName = region?.name || countryCode.toUpperCase()
    const canonical = `${siteUrl}/${countryCode}/store`
    const title = `Buy Prescription & OTC Medicines Online ${regionName} | Suprameds`
    const description = `Browse 750+ generic medicines at 50-80% off MRP. Prescription and OTC drugs dispensed by registered pharmacists. Free delivery above ₹300. CDSCO-registered online pharmacy.`

    const { products } = loaderData || {}

    const itemListSchema = {
      "@context": "https://schema.org",
      "@type": "ItemList",
      itemListElement: products?.slice(0, 12).map((p, i) => ({
        "@type": "ListItem",
        position: i + 1,
        url: `${siteUrl}/${countryCode}/products/${p.handle}`,
        name: p.title,
        image: p.thumbnail || undefined,
      })),
    }

    return {
      meta: [
        { title },
        { name: "description", content: description },
        { property: "og:title", content: title },
        { property: "og:description", content: description },
        { property: "og:type", content: "website" },
        { property: "og:url", content: canonical },
        { property: "twitter:card", content: "summary_large_image" },
        { property: "twitter:title", content: title },
        { property: "twitter:description", content: description },
      ],
      links: [
        { rel: "canonical", href: canonical },
      ],
      scripts: [
        { type: "application/ld+json", children: JSON.stringify(itemListSchema) },
      ],
    }
  },
  component: Store,
})