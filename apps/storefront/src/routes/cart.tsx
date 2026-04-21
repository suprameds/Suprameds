import { createFileRoute, notFound } from "@tanstack/react-router"
import Cart from "@/pages/cart"
import { CartSkeleton } from "@/components/ui/skeletons"
import { getRegion } from "@/lib/data/regions"
import { DEFAULT_COUNTRY_CODE } from "@/lib/constants/site"

export const Route = createFileRoute("/cart")({
  head: () => ({
    meta: [
      { title: "Shopping Cart | Suprameds" },
      { name: "robots", content: "noindex, nofollow" },
    ],
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

    return {
      region,
    }
  },
  pendingComponent: CartSkeleton,
  component: Cart,
})
