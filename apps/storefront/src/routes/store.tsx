import { createFileRoute, notFound } from "@tanstack/react-router"
import { getRegion } from "@/lib/data/regions"
import Store from "@/pages/store"
import { StorePageSkeleton } from "@/components/ui/skeletons"
import { listProducts } from "@/lib/data/products"
import { HttpTypes } from "@medusajs/types"
import { DEFAULT_COUNTRY_CODE } from "@/lib/constants/site"

type StoreSearchParams = {
  q?: string
  schedule?: string
}

export const Route = createFileRoute("/store")({
  validateSearch: (search: Record<string, unknown>): StoreSearchParams => ({
    q: typeof search.q === "string" ? search.q : undefined,
    schedule: typeof search.schedule === "string" ? search.schedule : undefined,
  }),
  loader: async ({ context }) => {
    const { queryClient } = context

    const region = await queryClient.ensureQueryData({
      queryKey: ["region", DEFAULT_COUNTRY_CODE],
      queryFn: () => getRegion({ country_code: DEFAULT_COUNTRY_CODE }),
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
      region,
      products: products as HttpTypes.StoreProduct[],
    }
  },
  head: ({ loaderData }) => {
    const { region } = loaderData || {}
    const siteUrl = import.meta.env.VITE_SITE_URL || "https://supracyn.in"
    const regionName = region?.name || DEFAULT_COUNTRY_CODE.toUpperCase()
    const canonical = `${siteUrl}/store`
    const title = `Buy Prescription & OTC Medicines Online ${regionName} | Suprameds`
    const description = `Browse 750+ generic medicines at 50-80% off MRP. Prescription and OTC drugs dispensed by registered pharmacists. Free delivery above ₹300. CDSCO-registered online pharmacy.`

    const { products } = loaderData || {}

    const itemListSchema = {
      "@context": "https://schema.org",
      "@type": "ItemList",
      itemListElement: products?.slice(0, 12).map((p, i) => ({
        "@type": "ListItem",
        position: i + 1,
        url: `${siteUrl}/products/${p.handle}`,
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
  pendingComponent: StorePageSkeleton,
  component: Store,
})
