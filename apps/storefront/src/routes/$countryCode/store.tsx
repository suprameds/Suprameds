import { createFileRoute, notFound } from "@tanstack/react-router"
import { getRegion } from "@/lib/data/regions"
import Store from "@/pages/store"
import { listProducts } from "@/lib/data/products"
import { HttpTypes } from "@medusajs/types"

export const Route = createFileRoute("/$countryCode/store")({
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
    const title = `All Medicines — ${regionName} | Suprameds`
    const description = `Browse prescription and OTC medicines available in ${regionName}. Pharmacist-dispensed. Speed Post delivery across India.`

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
    }
  },
  component: Store,
})