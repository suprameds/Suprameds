import { createFileRoute, notFound } from "@tanstack/react-router"
import { getRegion } from "@/lib/data/regions"
import Search from "@/pages/search"

type SearchParams = {
  q?: string
}

export const Route = createFileRoute("/$countryCode/search")({
  validateSearch: (search: Record<string, unknown>): SearchParams => ({
    q: typeof search.q === "string" ? search.q : undefined,
  }),
  loaderDeps: ({ search }) => ({ q: search.q }),
  loader: async ({ params, context, deps }) => {
    const { countryCode } = params
    const { queryClient } = context

    const region = await queryClient.ensureQueryData({
      queryKey: ["region", countryCode],
      queryFn: () => getRegion({ country_code: countryCode }),
    })

    if (!region) {
      throw notFound()
    }

    return {
      countryCode,
      region,
      q: deps.q || "",
    }
  },
  head: ({ loaderData }) => {
    const q = loaderData?.q
    const title = q
      ? `"${q}" — Search Results | Suprameds`
      : "Search Medicines | Suprameds"

    return {
      meta: [
        { title },
        { name: "description", content: "Search prescription and OTC medicines on Suprameds." },
      ],
    }
  },
  component: Search,
})
