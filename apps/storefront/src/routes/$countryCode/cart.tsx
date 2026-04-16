import { createFileRoute, notFound } from "@tanstack/react-router"
import Cart from "@/pages/cart"
import { CartSkeleton } from "@/components/ui/skeletons"
import { getRegion } from "@/lib/data/regions"

export const Route = createFileRoute("/$countryCode/cart")({
  head: () => ({
    meta: [
      { title: "Shopping Cart | Suprameds" },
      { name: "robots", content: "noindex, nofollow" },
    ],
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

    return {
      region,
      countryCode,
    }
  },
  pendingComponent: CartSkeleton,
  component: Cart,
})