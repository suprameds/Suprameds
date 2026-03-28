import { createFileRoute, notFound } from "@tanstack/react-router"
import { retrieveCategory } from "@/lib/data/categories"
import { getRegion } from "@/lib/data/regions"
import { listProducts } from "@/lib/data/products"
import Category from "@/pages/category"
import { HttpTypes } from "@medusajs/types"

export const Route = createFileRoute("/$countryCode/categories/$handle")({
  loader: async ({ params, context }) => {
    const { countryCode, handle } = params
    const { queryClient } = context

    // Pre-fetch region data
    const region = await queryClient.ensureQueryData({
      queryKey: ["region", countryCode],
      queryFn: () => getRegion({ country_code: countryCode }),
    })

    if (!region || !handle) {
      throw notFound()
    }

    // Fetch category by handle
    const category = await queryClient.ensureQueryData({
      queryKey: ["category", handle],
      queryFn: async () => {
        try {
          return await retrieveCategory({ handle })
        } catch {
          throw notFound()
        }
      },
    })

    const { products } = await queryClient.ensureQueryData({
      queryKey: ["products", { region_id: region.id, category_id: category!.id }],
      queryFn: () => listProducts({
        query_params: {
          category_id: [category!.id],
          limit: 12,
        },
        region_id: region.id,
      }),
    })

    return {
      countryCode,
      region,
      category: category as HttpTypes.StoreProductCategory,
      products: products as HttpTypes.StoreProduct[],
    }
  },
  head: ({ loaderData, params }) => {
    const { region, category, products } = loaderData || {}
    const siteUrl = import.meta.env.VITE_SITE_URL || "https://suprameds.in"
    const countryCode = params?.countryCode || "in"
    const regionName = region?.name || countryCode.toUpperCase()
    const categoryName = category?.name || "Category"
    const canonical = `${siteUrl}/${countryCode}/categories/${category?.handle || params?.handle}`
    const title = `${categoryName} - ${regionName} | Suprameds`
    const description = `Shop ${categoryName.toLowerCase()} medicines online. Pharmacist-dispensed, delivered across ${regionName}. CDSCO-registered pharmacy.`

    const breadcrumbSchema = {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "Home", item: `${siteUrl}/${countryCode}` },
        { "@type": "ListItem", position: 2, name: "Store", item: `${siteUrl}/${countryCode}/store` },
        { "@type": "ListItem", position: 3, name: categoryName, item: canonical },
      ],
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
        { type: "application/ld+json", children: JSON.stringify(breadcrumbSchema) },
        {
          type: "application/ld+json",
          children: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "ItemList",
            itemListElement: products?.slice(0, 12).map((p, i) => ({
              "@type": "ListItem",
              position: i + 1,
              url: `${siteUrl}/${countryCode}/products/${p.handle}`,
              name: p.title,
              image: p.thumbnail || undefined,
            })),
          }),
        },
      ],
    }
  },
  component: Category,
})
