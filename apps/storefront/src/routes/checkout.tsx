import { createFileRoute, notFound } from "@tanstack/react-router"
import Checkout from "@/pages/checkout"
import { getRegion } from "@/lib/data/regions"
import { CheckoutStepKey } from "@/lib/types/global"
import { DEFAULT_COUNTRY_CODE } from "@/lib/constants/site"

export const Route = createFileRoute("/checkout")({
  head: () => ({
    meta: [
      { title: "Checkout | Suprameds" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  validateSearch: (search) => {
    let step = search.step
    if (!Object.values(CheckoutStepKey).includes(step as CheckoutStepKey)) {
      step = "addresses"
    }
    return {
      step,
    }
  },
  loaderDeps: ({ search: { step } }) => {
    return {
      step,
    }
  },
  loader: async ({ context, deps }) => {
    const { queryClient } = context
    const { step } = deps

    const region = await queryClient.ensureQueryData({
      queryKey: ["region", DEFAULT_COUNTRY_CODE],
      queryFn: () => getRegion({ country_code: DEFAULT_COUNTRY_CODE }),
    })

    if (!region) {
      throw notFound()
    }

    return {
      region,
      step,
    }
  },
  component: Checkout,
})
