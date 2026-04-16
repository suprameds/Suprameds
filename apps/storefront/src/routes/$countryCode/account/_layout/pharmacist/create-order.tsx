import { createFileRoute } from "@tanstack/react-router"
// @ts-expect-error Page will be created in a subsequent task
import CreateOrderPage from "@/pages/account/pharmacist/create-order"

export const Route = createFileRoute(
  // @ts-expect-error Route path not in route tree yet — regenerates on pnpm dev/build
  "/$countryCode/account/_layout/pharmacist/create-order"
)({
  head: () => ({
    meta: [
      { title: "Create Order | Pharmacist | Suprameds" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: CreateOrderPage,
})
