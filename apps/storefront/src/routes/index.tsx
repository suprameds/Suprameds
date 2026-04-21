import Home from "@/pages/home"
import { HomePageSkeleton } from "@/components/ui/skeletons"
import { createFileRoute, notFound } from "@tanstack/react-router"
import { getRegion } from "@/lib/data/regions"
import { listProducts } from "@/lib/data/products"
import { queryKeys } from "@/lib/utils/query-keys"
import { DEFAULT_COUNTRY_CODE } from "@/lib/constants/site"

export const Route = createFileRoute("/")({
  loader: async ({ context }) => {
    const { queryClient } = context

    // Fetch region for the country code
    const region = await queryClient.ensureQueryData({
      queryKey: ["region", DEFAULT_COUNTRY_CODE],
      queryFn: () => getRegion({ country_code: DEFAULT_COUNTRY_CODE }),
    })

    if (!region) {
      throw notFound()
    }

    // Prefetch latest products for SSR (non-blocking)
    // FeaturedProducts component will use cached data when available
    queryClient.prefetchQuery({
      queryKey: queryKeys.products.latest(4, region.id),
      queryFn: () =>
        listProducts({
          query_params: {
            limit: 4,
            order: "-created_at",
          },
          region_id: region.id,
        }),
    })

    return {
      region,
    }
  },
  head: () => {
    const siteUrl = import.meta.env.VITE_SITE_URL || "https://supracyn.in"
    const canonical = `${siteUrl}`
    const title = `Buy Generic Medicines Online at 50-80% Off | Suprameds`
    const description = `Buy affordable generic medicines online from India's licensed pharmacy (DL: TS/HYD/2021-82149). Same composition, 50-80% off MRP. Pharmacist-dispensed, Speed Post delivery across India.`

    const organizationSchema = {
      "@context": "https://schema.org",
      "@type": "Organization",
      name: "Suprameds",
      url: siteUrl,
      logo: `${siteUrl}/images/suprameds.svg`,
      description: "CDSCO-registered online pharmacy delivering pharmacist-dispensed medicines across India.",
      address: {
        "@type": "PostalAddress",
        addressCountry: "IN",
      },
    }

    const websiteSchema = {
      "@context": "https://schema.org",
      "@type": "WebSite",
      name: "Suprameds",
      url: siteUrl,
      potentialAction: {
        "@type": "SearchAction",
        target: {
          "@type": "EntryPoint",
          urlTemplate: `${siteUrl}/search?q={search_term_string}`,
        },
        "query-input": "required name=search_term_string",
      },
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
        { type: "application/ld+json", children: JSON.stringify(organizationSchema) },
        { type: "application/ld+json", children: JSON.stringify(websiteSchema) },
      ],
    }
  },
  pendingComponent: HomePageSkeleton,
  component: Home,
})
